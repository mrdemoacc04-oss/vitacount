-- Workspace profile, Projects (job costing) and native FIFO Inventory.
--
-- project.md §2.7/§2.8 deferred these past the MVP; built now on request
-- (CONTEXT_LOG.md, 2026-10-08). Everything is additive. The four posting
-- functions that gain parameters (create_sales_document, create_bill_received,
-- create_vendor_credit, post_expense_created) get them as trailing DEFAULT NULL
-- params, so every existing caller keeps working unchanged.
--
--   1. Workspace profile: legal name, EIN, contact details, address, fiscal
--      year, invoicing defaults — edited only through update_workspace_profile
--      (owners/admins).
--   2. Projects: a customer job with a budget. Invoices, bills, supplier credits
--      and expenses can be tagged to one; project_financials rolls up revenue,
--      costs (including the FIFO cost of stock sold on the project) and margin.
--   3. Items: one catalog for products and services. Inventory items carry
--      FIFO cost layers. The ledger stays the source of truth:
--        bill line for a stock item   Dr Inventory Asset   / Cr AP  (+ cost layer)
--        sale of a stock item         Dr Cost of Goods Sold / Cr Inventory Asset
--        refund of a stock item       Dr Inventory Asset   / Cr Cost of Goods Sold
--        supplier credit, stock item  Cr Inventory Asset at the credit amount,
--                                     difference to FIFO cost trued up via COGS
--        stock adjustment / opening   Inventory Asset vs Inventory Adjustments
--                                     (5010) / Opening Balance Equity (3020)
--      Layers track cost_remaining in cents, so the sum of layers always equals
--      the Inventory Asset postings exactly — no rounding drift.
--
-- Same rules as every posting function since Session 4: SECURITY DEFINER, an
-- explicit active-membership check, and every referenced row re-checked against
-- p_tenant_id because the definer bypasses RLS.

-- ---------------------------------------------------------------------------
-- 1. Workspace profile
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column legal_name text,
  add column tax_id text,
  add column email text,
  add column phone text,
  add column website text,
  add column address jsonb not null default '{}', -- {line1, line2, city, state, postalCode, country}
  add column fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  add column timezone text not null default 'America/New_York',
  add column default_payment_terms text not null default 'net_30'
    check (default_payment_terms in ('due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'none')),
  add column invoice_notes text,
  add column invoice_footer text;

create or replace function public.update_workspace_profile(
  p_tenant_id uuid,
  p_name text,
  p_legal_name text,
  p_tax_id text,
  p_email text,
  p_phone text,
  p_website text,
  p_address jsonb,
  p_fiscal_year_start_month int,
  p_timezone text,
  p_default_payment_terms text,
  p_default_tax_rate numeric,
  p_invoice_notes text,
  p_invoice_footer text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  ) then
    raise exception 'only owners and admins can change workspace settings';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'the workspace needs a name';
  end if;
  if p_default_tax_rate is not null and (p_default_tax_rate < 0 or p_default_tax_rate > 1) then
    raise exception 'the default tax rate must be between 0%% and 100%%';
  end if;
  if p_address is not null and jsonb_typeof(p_address) <> 'object' then
    raise exception 'malformed address';
  end if;

  update tenants set
    name = trim(p_name),
    legal_name = nullif(trim(p_legal_name), ''),
    tax_id = nullif(trim(p_tax_id), ''),
    email = nullif(trim(p_email), ''),
    phone = nullif(trim(p_phone), ''),
    website = nullif(trim(p_website), ''),
    address = coalesce(p_address, '{}'::jsonb),
    fiscal_year_start_month = coalesce(p_fiscal_year_start_month, 1),
    timezone = coalesce(nullif(trim(p_timezone), ''), 'America/New_York'),
    default_payment_terms = coalesce(p_default_payment_terms, 'net_30'),
    default_tax_rate = coalesce(p_default_tax_rate, 0),
    invoice_notes = nullif(trim(p_invoice_notes), ''),
    invoice_footer = nullif(trim(p_invoice_footer), '')
  where id = p_tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.contacts(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  code text,
  description text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  budget numeric(14, 2) check (budget is null or budget >= 0),
  start_date date,
  end_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create index projects_tenant_idx on public.projects (tenant_id);
create unique index projects_tenant_code_key on public.projects (tenant_id, lower(code)) where code is not null;

alter table public.projects enable row level security;
create policy "projects_select" on public.projects for select using (tenant_id in (select public.current_tenant_ids()));
create policy "projects_insert" on public.projects for insert with check (tenant_id in (select public.current_tenant_ids()));
create policy "projects_update" on public.projects for update
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
create policy "projects_delete" on public.projects for delete using (tenant_id in (select public.current_admin_tenant_ids()));

-- RLS can't see across tables: make sure the customer is from the same workspace.
create or replace function public.projects_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.customer_id is not null and not exists (
    select 1 from contacts where id = new.customer_id and tenant_id = new.tenant_id
  ) then
    raise exception 'that customer does not belong to this workspace';
  end if;
  new.name := trim(new.name);
  new.code := nullif(trim(new.code), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_before_write
  before insert or update on public.projects
  for each row execute function public.projects_before_write();

alter table public.invoices
  add constraint invoices_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
alter table public.bills
  add constraint bills_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
alter table public.expenses
  add constraint expenses_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;

create index invoices_project_idx on public.invoices (project_id) where project_id is not null;
create index bills_project_idx on public.bills (project_id) where project_id is not null;
create index expenses_project_idx on public.expenses (project_id) where project_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Items, FIFO layers, movements
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('inventory', 'service', 'non_inventory')),
  name text not null check (length(trim(name)) > 0),
  sku text,
  description text,
  unit text,
  sales_price numeric(14, 2) check (sales_price is null or sales_price >= 0),
  purchase_cost numeric(14, 2) check (purchase_cost is null or purchase_cost >= 0),
  income_account_id uuid references public.accounts(id),
  expense_account_id uuid references public.accounts(id), -- COGS for stock items, purchase category otherwise
  asset_account_id uuid references public.accounts(id),   -- stock items only
  reorder_point numeric(12, 2) check (reorder_point is null or reorder_point >= 0),
  reorder_qty numeric(12, 2) check (reorder_qty is null or reorder_qty > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_tenant_idx on public.items (tenant_id);
create unique index items_tenant_sku_key on public.items (tenant_id, lower(sku)) where sku is not null;

alter table public.items enable row level security;
create policy "items_select" on public.items for select using (tenant_id in (select public.current_tenant_ids()));
create policy "items_insert" on public.items for insert with check (tenant_id in (select public.current_tenant_ids()));
create policy "items_update" on public.items for update
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create table public.inventory_layers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null references public.items(id),
  received_date date not null,
  quantity_received numeric(12, 2) not null check (quantity_received > 0),
  quantity_remaining numeric(12, 2) not null check (quantity_remaining >= 0),
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  cost_remaining numeric(14, 2) not null check (cost_remaining >= 0),
  source_type text not null,
  source_id uuid,
  created_at timestamptz not null default now(),
  check (quantity_remaining <= quantity_received)
);

create index inventory_layers_fifo_idx on public.inventory_layers (item_id, received_date, created_at) where quantity_remaining > 0;
create index inventory_layers_tenant_idx on public.inventory_layers (tenant_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null references public.items(id),
  movement_date date not null,
  movement_type text not null
    check (movement_type in ('opening', 'receipt', 'sale', 'sale_return', 'purchase_return', 'adjustment')),
  quantity numeric(12, 2) not null check (quantity <> 0), -- + into stock, - out of stock
  total_cost numeric(14, 2) not null,                    -- signed like quantity
  layer_id uuid references public.inventory_layers(id),
  source_type text not null,
  source_id uuid,
  journal_entry_id uuid references public.journal_entries(id),
  memo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index inventory_movements_item_idx on public.inventory_movements (item_id, movement_date desc, created_at desc);
create index inventory_movements_tenant_idx on public.inventory_movements (tenant_id);
create index inventory_movements_source_idx on public.inventory_movements (source_id) where source_id is not null;

alter table public.inventory_layers enable row level security;
alter table public.inventory_movements enable row level security;
-- Read-only to members: layers and movements are only ever written by the posting functions below.
create policy "inventory_layers_select" on public.inventory_layers for select using (tenant_id in (select public.current_tenant_ids()));
create policy "inventory_movements_select" on public.inventory_movements for select using (tenant_id in (select public.current_tenant_ids()));

alter table public.invoice_lines
  add constraint invoice_lines_item_id_fkey foreign key (item_id) references public.items(id);
alter table public.bill_lines
  add constraint bill_lines_item_id_fkey foreign key (item_id) references public.items(id);
create index invoice_lines_item_idx on public.invoice_lines (item_id) where item_id is not null;
create index bill_lines_item_idx on public.bill_lines (item_id) where item_id is not null;

-- Finds (or creates) one of the standard accounts by code.
create or replace function public._ensure_account(p_tenant_id uuid, p_code text, p_name text, p_type text, p_subtype text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from accounts where tenant_id = p_tenant_id and code = p_code;
  if v_id is null then
    insert into accounts (tenant_id, code, name, type, subtype)
    values (p_tenant_id, p_code, p_name, p_type, p_subtype)
    on conflict (tenant_id, code) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from accounts where tenant_id = p_tenant_id and code = p_code;
    end if;
  end if;
  return v_id;
end;
$$;

-- Defaults each item's accounts from the standard chart, and keeps every
-- account reference inside the item's own workspace.
create or replace function public.items_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := trim(new.name);
  new.sku := nullif(trim(new.sku), '');
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id then
      raise exception 'items can''t move between workspaces';
    end if;
    if old.type = 'inventory' and new.type <> 'inventory'
       and exists (select 1 from inventory_movements where item_id = old.id) then
      raise exception 'this item has stock history, so it has to stay a stock item — archive it instead';
    end if;
    if old.type <> 'inventory' and new.type = 'inventory'
       and (exists (select 1 from invoice_lines where item_id = old.id)
            or exists (select 1 from bill_lines where item_id = old.id)) then
      raise exception 'this item has already been used on documents, so it can''t become a stock item — create a new stock item instead';
    end if;
  end if;

  if new.income_account_id is null then
    select id into new.income_account_id from accounts
     where tenant_id = new.tenant_id and code = case when new.type = 'service' then '4010' else '4000' end;
  end if;
  if new.type = 'inventory' then
    if new.expense_account_id is null then
      select id into new.expense_account_id from accounts where tenant_id = new.tenant_id and code = '5000';
    end if;
    if new.asset_account_id is null then
      select id into new.asset_account_id from accounts where tenant_id = new.tenant_id and code = '1200';
    end if;
    if new.expense_account_id is null or new.asset_account_id is null then
      raise exception 'stock items need an Inventory Asset and a Cost of Goods Sold account';
    end if;
  else
    new.asset_account_id := null;
    new.reorder_point := null;
    new.reorder_qty := null;
  end if;

  if exists (
    select 1 from (values (new.income_account_id), (new.expense_account_id), (new.asset_account_id)) a(id)
     where a.id is not null
       and not exists (select 1 from accounts where accounts.id = a.id and accounts.tenant_id = new.tenant_id)
  ) then
    raise exception 'an account on this item does not belong to this workspace';
  end if;

  return new;
end;
$$;

create trigger items_before_write
  before insert or update on public.items
  for each row execute function public.items_before_write();

create view public.item_stock with (security_invoker = true) as
select
  i.id as item_id,
  i.tenant_id,
  coalesce(sum(l.quantity_remaining), 0)::numeric(14, 2) as quantity_on_hand,
  coalesce(sum(l.cost_remaining), 0)::numeric(14, 2) as stock_value
from public.items i
left join public.inventory_layers l on l.item_id = i.id and l.quantity_remaining > 0
group by i.id, i.tenant_id;

grant select on public.item_stock to authenticated;

-- Adds stock: one new FIFO layer + its movement. Returns the layer id.
create or replace function public._inventory_receive(
  p_tenant_id uuid,
  p_item_id uuid,
  p_date date,
  p_quantity numeric,
  p_total_cost numeric,
  p_movement_type text,
  p_source_type text,
  p_source_id uuid,
  p_memo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_layer_id uuid;
  v_cost numeric := round(coalesce(p_total_cost, 0), 2);
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'stock received must be a quantity above zero';
  end if;
  if v_cost < 0 then
    raise exception 'stock can''t be received at a negative cost';
  end if;

  insert into inventory_layers (tenant_id, item_id, received_date, quantity_received, quantity_remaining, unit_cost, cost_remaining, source_type, source_id)
  values (p_tenant_id, p_item_id, p_date, p_quantity, p_quantity, round(v_cost / p_quantity, 4), v_cost, p_source_type, p_source_id)
  returning id into v_layer_id;

  insert into inventory_movements (tenant_id, item_id, movement_date, movement_type, quantity, total_cost, layer_id, source_type, source_id, memo, created_by)
  values (p_tenant_id, p_item_id, p_date, p_movement_type, p_quantity, v_cost, v_layer_id, p_source_type, p_source_id, p_memo, auth.uid());

  return v_layer_id;
end;
$$;

-- Takes stock out oldest layer first. Returns the FIFO cost of what was taken.
-- Locks the item row so two sales of the same item can't both consume one layer.
create or replace function public._inventory_consume(
  p_tenant_id uuid,
  p_item_id uuid,
  p_date date,
  p_quantity numeric,
  p_movement_type text,
  p_source_type text,
  p_source_id uuid,
  p_memo text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item items%rowtype;
  v_available numeric;
  v_need numeric := p_quantity;
  v_take numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_layer inventory_layers%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'stock taken out must be a quantity above zero';
  end if;

  select * into v_item from items where id = p_item_id and tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'item % does not belong to this workspace', p_item_id;
  end if;

  select coalesce(sum(quantity_remaining), 0) into v_available
    from inventory_layers where item_id = p_item_id and quantity_remaining > 0;

  if v_available < p_quantity then
    raise exception 'not enough "%" in stock: % on hand, % needed', v_item.name, v_available, p_quantity;
  end if;

  for v_layer in
    select * from inventory_layers
     where item_id = p_item_id and quantity_remaining > 0
     order by received_date, created_at, id
  loop
    v_take := least(v_need, v_layer.quantity_remaining);
    -- emptying a layer takes its exact remaining cost, so layers never strand a stray cent
    v_cost := case when v_take = v_layer.quantity_remaining then v_layer.cost_remaining
                   else least(round(v_take * v_layer.unit_cost, 2), v_layer.cost_remaining) end;

    update inventory_layers
       set quantity_remaining = quantity_remaining - v_take,
           cost_remaining = cost_remaining - v_cost
     where id = v_layer.id;

    insert into inventory_movements (tenant_id, item_id, movement_date, movement_type, quantity, total_cost, layer_id, source_type, source_id, memo, created_by)
    values (p_tenant_id, p_item_id, p_date, p_movement_type, -v_take, -v_cost, v_layer.id, p_source_type, p_source_id, p_memo, auth.uid());

    v_total := v_total + v_cost;
    v_need := v_need - v_take;
    exit when v_need <= 0;
  end loop;

  return v_total;
end;
$$;

-- Stock and cost-of-goods for a posted sales document: sales take stock out at
-- FIFO cost (Dr COGS / Cr Inventory); refunds of a sale put it back at the cost
-- it most recently left at (Dr Inventory / Cr COGS). Debit notes and credit
-- refunds don't move stock.
create or replace function public._post_sales_document_inventory(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc invoices%rowtype;
  v_line record;
  v_entry_id uuid;
  v_cost numeric;
  v_unit numeric;
  v_label text;
begin
  select * into v_doc from invoices where id = p_document_id;
  if v_doc.document_type not in ('invoice', 'sales_receipt')
     and not (v_doc.document_type = 'refund_receipt' and v_doc.refund_source = 'sale') then
    return;
  end if;

  v_label := 'Cost of goods, ' || v_doc.invoice_number;

  for v_line in
    select il.quantity, il.description, it.id as item_id, it.name, it.expense_account_id, it.asset_account_id, it.purchase_cost
      from invoice_lines il
      join items it on it.id = il.item_id
     where il.invoice_id = p_document_id and it.type = 'inventory'
     order by il.sort_order
  loop
    if v_doc.document_type = 'refund_receipt' then
      select -m.total_cost / nullif(-m.quantity, 0) into v_unit
        from inventory_movements m
       where m.item_id = v_line.item_id and m.movement_type = 'sale'
       order by m.movement_date desc, m.created_at desc
       limit 1;
      if v_unit is null then
        select stock_value / nullif(quantity_on_hand, 0) into v_unit from item_stock where item_id = v_line.item_id;
      end if;
      v_cost := round(v_line.quantity * coalesce(v_unit, v_line.purchase_cost, 0), 2);
      perform _inventory_receive(v_doc.tenant_id, v_line.item_id, v_doc.issue_date, v_line.quantity, v_cost,
                                 'sale_return', v_doc.document_type, v_doc.id, v_label);
    else
      v_cost := _inventory_consume(v_doc.tenant_id, v_line.item_id, v_doc.issue_date, v_line.quantity,
                                   'sale', v_doc.document_type, v_doc.id, v_label);
    end if;

    if v_cost > 0 then
      if v_entry_id is null then
        insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by)
        values (v_doc.tenant_id, v_doc.issue_date, v_label, 'inventory_cogs', v_doc.id, 'posted', now(), auth.uid())
        returning id into v_entry_id;
      end if;

      if v_doc.document_type = 'refund_receipt' then
        insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
        values (v_entry_id, v_line.asset_account_id, v_cost, 0, v_line.name),
               (v_entry_id, v_line.expense_account_id, 0, v_cost, v_line.name);
      else
        insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
        values (v_entry_id, v_line.expense_account_id, v_cost, 0, v_line.name),
               (v_entry_id, v_line.asset_account_id, 0, v_cost, v_line.name);
      end if;
    end if;
  end loop;

  if v_entry_id is not null then
    update inventory_movements set journal_entry_id = v_entry_id
     where source_id = p_document_id and journal_entry_id is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Sales documents: items, per-item revenue accounts, project, stock
-- ---------------------------------------------------------------------------
drop function public.create_sales_document(uuid, uuid, text, date, date, text, text, jsonb);

create function public.create_sales_document(
  p_tenant_id uuid,
  p_contact_id uuid,
  p_document_type text,
  p_issue_date date,
  p_due_date date,
  p_payment_method text,
  p_payment_reference text,
  p_lines jsonb, -- [{ "itemId": uuid|null, "description": text, "quantity": numeric, "unitPrice": numeric, "taxRate": numeric (fraction) }, ...]
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_receipt boolean;
  v_doc_id uuid;
  v_number text;
  v_line jsonb;
  v_line_no int := 0;
  v_item items%rowtype;
  v_item_id uuid;
  v_qty numeric;
  v_price numeric;
  v_rate numeric;
  v_amount numeric;
  v_subtotal numeric := 0;
  v_tax_raw numeric := 0;
  v_tax numeric;
  v_total numeric;
  v_cash_id uuid;
  v_revenue_id uuid;
  v_tax_id uuid;
  v_entry_id uuid;
  v_label text;
  v_rev record;
begin
  if not exists (
    select 1 from memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;

  if p_document_type is null or p_document_type not in ('invoice', 'sales_receipt', 'refund_receipt', 'debit_note') then
    raise exception 'unknown sales document type %', p_document_type;
  end if;
  v_is_receipt := p_document_type in ('sales_receipt', 'refund_receipt');

  if not exists (select 1 from contacts where id = p_contact_id and tenant_id = p_tenant_id) then
    raise exception 'customer % does not belong to this workspace', p_contact_id;
  end if;
  if p_project_id is not null and not exists (select 1 from projects where id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'that project does not belong to this workspace';
  end if;

  if p_issue_date is null then
    raise exception 'a date is required';
  end if;
  if not v_is_receipt and p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'the due date can''t be before the issue date';
  end if;
  if v_is_receipt and coalesce(trim(p_payment_method), '') = '' then
    raise exception 'choose how the money was paid';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'add at least one line item';
  end if;

  -- Serialize numbering per tenant so two concurrent saves can't claim the same number.
  perform pg_advisory_xact_lock(hashtext('vitacount.sales_document_number'), hashtext(p_tenant_id::text));
  v_number := next_document_number(p_tenant_id, p_document_type);

  insert into invoices (
    tenant_id, contact_id, project_id, invoice_number, document_type, issue_date, due_date, status,
    payment_method, payment_reference, refund_source, created_by
  ) values (
    p_tenant_id, p_contact_id, p_project_id, v_number, p_document_type, p_issue_date,
    case when v_is_receipt then null else p_due_date end,
    'draft',
    case when v_is_receipt then trim(p_payment_method) end,
    case when v_is_receipt then nullif(trim(p_payment_reference), '') end,
    case when p_document_type = 'refund_receipt' then 'sale' end,
    auth.uid()
  )
  returning id into v_doc_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    v_item_id := nullif(v_line->>'itemId', '')::uuid;
    v_qty := round((v_line->>'quantity')::numeric, 2);
    v_price := round((v_line->>'unitPrice')::numeric, 2);
    v_rate := round(coalesce((v_line->>'taxRate')::numeric, 0), 6);

    if v_item_id is not null then
      select * into v_item from items where id = v_item_id and tenant_id = p_tenant_id;
      if not found then
        raise exception 'line % uses an item from another workspace', v_line_no;
      end if;
      if not v_item.is_active then
        raise exception 'line %: "%" is archived', v_line_no, v_item.name;
      end if;
      if v_item.type = 'inventory' and p_document_type = 'debit_note' then
        raise exception 'line %: debit notes can''t include stock items', v_line_no;
      end if;
    end if;

    if v_qty is null or v_qty <= 0 then
      raise exception 'line % needs a quantity above zero', v_line_no;
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'line % needs a price of zero or more', v_line_no;
    end if;
    if v_rate < 0 or v_rate > 1 then
      raise exception 'line % has a tax rate outside 0%%–100%%', v_line_no;
    end if;

    v_amount := round(v_qty * v_price, 2);

    insert into invoice_lines (invoice_id, item_id, description, quantity, unit_price, tax_rate, amount, sort_order)
    values (
      v_doc_id, v_item_id,
      coalesce(nullif(trim(v_line->>'description'), ''), case when v_item_id is not null then v_item.name end),
      v_qty, v_price, v_rate, v_amount, v_line_no - 1
    );

    v_subtotal := v_subtotal + v_amount;
    v_tax_raw := v_tax_raw + v_amount * v_rate;
  end loop;

  v_tax := round(v_tax_raw, 2);
  v_total := v_subtotal + v_tax;

  if v_total <= 0 then
    raise exception 'the total must be more than zero';
  end if;

  update invoices set subtotal = v_subtotal, tax_total = v_tax, total = v_total where id = v_doc_id;

  if v_is_receipt then
    select id into v_cash_id from accounts where tenant_id = p_tenant_id and code = '1000';
    select id into v_revenue_id from accounts where tenant_id = p_tenant_id and code = '4000';
    select id into v_tax_id from accounts where tenant_id = p_tenant_id and code = '2010';

    if v_cash_id is null or v_revenue_id is null then
      raise exception 'tenant % is missing the standard Cash/Revenue accounts (codes 1000/4000)', p_tenant_id;
    end if;
    if v_tax > 0 and v_tax_id is null then
      raise exception 'tenant % is missing the Sales Tax Payable account (code 2010)', p_tenant_id;
    end if;

    v_label := case p_document_type when 'sales_receipt' then 'Sales receipt ' else 'Refund ' end || v_number;

    insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by)
    values (p_tenant_id, p_issue_date, v_label, p_document_type, v_doc_id, 'posted', now(), auth.uid())
    returning id into v_entry_id;

    if p_document_type = 'sales_receipt' then
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_entry_id, v_cash_id, v_total, 0, v_label);
    else
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_entry_id, v_cash_id, 0, v_total, v_label);
    end if;

    -- revenue lands on each item's income account (plain lines use Sales Revenue)
    for v_rev in
      select coalesce(it.income_account_id, v_revenue_id) as account_id, sum(il.amount) as amount
        from invoice_lines il left join items it on it.id = il.item_id
       where il.invoice_id = v_doc_id
       group by 1
      having sum(il.amount) <> 0
    loop
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (
        v_entry_id, v_rev.account_id,
        case when p_document_type = 'refund_receipt' then v_rev.amount else 0 end,
        case when p_document_type = 'sales_receipt' then v_rev.amount else 0 end,
        v_label
      );
    end loop;

    if v_tax > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (
        v_entry_id, v_tax_id,
        case when p_document_type = 'refund_receipt' then v_tax else 0 end,
        case when p_document_type = 'sales_receipt' then v_tax else 0 end,
        case when p_document_type = 'sales_receipt' then 'Sales tax on ' else 'Sales tax refunded on ' end || v_number
      );
    end if;

    update invoices set status = 'paid', balance_due = 0 where id = v_doc_id;

    perform _post_sales_document_inventory(v_doc_id);
  end if;

  return v_doc_id;
end;
$$;

create or replace function public.post_invoice_issued(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice invoices%rowtype;
  v_ar_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_entry_id uuid;
  v_label text;
  v_rev record;
begin
  select * into v_invoice from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice % not found', p_invoice_id;
  end if;

  if not exists (
    select 1 from memberships
    where tenant_id = v_invoice.tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;

  if v_invoice.document_type not in ('invoice', 'debit_note') then
    raise exception '% is posted when it''s created and can''t be issued again', v_invoice.invoice_number;
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'invoice % has already been issued (status=%)', p_invoice_id, v_invoice.status;
  end if;

  select id into v_ar_account_id from accounts where tenant_id = v_invoice.tenant_id and code = '1010';
  select id into v_revenue_account_id from accounts where tenant_id = v_invoice.tenant_id and code = '4000';
  select id into v_tax_account_id from accounts where tenant_id = v_invoice.tenant_id and code = '2010';

  if v_ar_account_id is null or v_revenue_account_id is null then
    raise exception 'tenant % is missing the standard AR/Revenue accounts (codes 1010/4000)', v_invoice.tenant_id;
  end if;

  v_label := case v_invoice.document_type when 'debit_note' then 'Debit note ' else 'Invoice ' end
             || v_invoice.invoice_number;

  insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by)
  values (v_invoice.tenant_id, v_invoice.issue_date, v_label || ' issued', v_invoice.document_type, v_invoice.id, 'posted', now(), auth.uid())
  returning id into v_entry_id;

  insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_entry_id, v_ar_account_id, v_invoice.total, 0, v_label);

  for v_rev in
    select coalesce(it.income_account_id, v_revenue_account_id) as account_id, sum(il.amount) as amount
      from invoice_lines il left join items it on it.id = il.item_id
     where il.invoice_id = v_invoice.id
     group by 1
    having sum(il.amount) <> 0
  loop
    insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_entry_id, v_rev.account_id, 0, v_rev.amount, v_label);
  end loop;

  if v_invoice.tax_total > 0 then
    if v_tax_account_id is null then
      raise exception 'tenant % is missing the Sales Tax Payable account (code 2010)', v_invoice.tenant_id;
    end if;
    insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_entry_id, v_tax_account_id, 0, v_invoice.tax_total, 'Sales tax on ' || v_invoice.invoice_number);
  end if;

  update invoices set status = 'sent', balance_due = total where id = p_invoice_id;

  perform _post_sales_document_inventory(v_invoice.id);

  return v_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Purchase side: bills, supplier credits, expenses
-- ---------------------------------------------------------------------------
-- Resolves a purchase line's ledger account: stock items always post to their
-- Inventory Asset account; other items default to their purchase category.
create or replace function public._purchase_line_account(p_tenant_id uuid, p_line jsonb, p_line_no int, out o_account_id uuid, out o_item_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item items%rowtype;
begin
  o_account_id := nullif(p_line->>'accountId', '')::uuid;
  o_item_id := nullif(p_line->>'itemId', '')::uuid;

  if o_item_id is not null then
    select * into v_item from items where id = o_item_id and tenant_id = p_tenant_id;
    if not found then
      raise exception 'line % uses an item from another workspace', p_line_no;
    end if;
    if not v_item.is_active then
      raise exception 'line %: "%" is archived', p_line_no, v_item.name;
    end if;
    if v_item.type = 'inventory' then
      o_account_id := v_item.asset_account_id;
    else
      o_account_id := coalesce(o_account_id, v_item.expense_account_id);
    end if;
  end if;

  if o_account_id is null or not exists (select 1 from accounts where id = o_account_id and tenant_id = p_tenant_id) then
    raise exception 'line % needs a category from this workspace', p_line_no;
  end if;
end;
$$;

drop function public.create_bill_received(uuid, uuid, text, date, date, jsonb);

create function public.create_bill_received(
  p_tenant_id uuid,
  p_vendor_id uuid,
  p_bill_number text,
  p_issue_date date,
  p_due_date date,
  p_lines jsonb, -- [{ "itemId": uuid|null, "accountId": uuid|null, "description": text, "quantity": numeric, "unitCost": numeric }, ...]
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_id uuid;
  v_ap_account_id uuid;
  v_entry_id uuid;
  v_line jsonb;
  v_line_no int := 0;
  v_account_id uuid;
  v_item_id uuid;
  v_item items%rowtype;
  v_qty numeric;
  v_cost numeric;
  v_amount numeric;
  v_total numeric := 0;
  v_label text;
  v_description text;
begin
  if not exists (
    select 1 from memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;

  if not exists (select 1 from contacts where id = p_vendor_id and tenant_id = p_tenant_id) then
    raise exception 'supplier % does not belong to this workspace', p_vendor_id;
  end if;
  if p_project_id is not null and not exists (select 1 from projects where id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'that project does not belong to this workspace';
  end if;
  if p_issue_date is null then
    raise exception 'a date is required';
  end if;
  if p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'the due date can''t be before the bill date';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'a bill needs at least one line';
  end if;

  select id into v_ap_account_id from accounts where tenant_id = p_tenant_id and code = '2000';
  if v_ap_account_id is null then
    raise exception 'tenant % is missing the standard Accounts Payable account (code 2000)', p_tenant_id;
  end if;

  insert into bills (tenant_id, vendor_id, project_id, bill_number, issue_date, due_date, status, created_by)
  values (p_tenant_id, p_vendor_id, p_project_id, nullif(trim(p_bill_number), ''), p_issue_date, p_due_date, 'open', auth.uid())
  returning id into v_bill_id;

  v_label := 'Bill ' || coalesce(nullif(trim(p_bill_number), ''), left(v_bill_id::text, 8));

  insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by)
  values (p_tenant_id, p_issue_date, v_label || ' received', 'bill', v_bill_id, 'posted', now(), auth.uid())
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    select o_account_id, o_item_id into v_account_id, v_item_id from _purchase_line_account(p_tenant_id, v_line, v_line_no);
    v_item := null;
    if v_item_id is not null then
      select * into v_item from items where id = v_item_id;
    end if;

    v_qty := round(coalesce((v_line->>'quantity')::numeric, 1), 2);
    v_cost := round((v_line->>'unitCost')::numeric, 2);
    if v_qty <= 0 then
      raise exception 'line % needs a quantity above zero', v_line_no;
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'line % needs an amount of zero or more', v_line_no;
    end if;

    v_amount := round(v_qty * v_cost, 2);
    v_description := coalesce(nullif(trim(v_line->>'description'), ''), v_item.name);

    insert into bill_lines (bill_id, account_id, item_id, description, quantity, unit_cost, amount, sort_order)
    values (v_bill_id, v_account_id, v_item.id, v_description, v_qty, v_cost, v_amount, v_line_no - 1);

    if v_amount > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_entry_id, v_account_id, v_amount, 0, v_description);
    end if;

    if v_item.type = 'inventory' then
      perform _inventory_receive(p_tenant_id, v_item.id, p_issue_date, v_qty, v_amount, 'receipt', 'bill', v_bill_id, v_label);
    end if;

    v_total := v_total + v_amount;
  end loop;

  if v_total <= 0 then
    raise exception 'the total must be more than zero';
  end if;

  insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_entry_id, v_ap_account_id, 0, v_total, v_label);

  update bills set total = v_total, balance_due = v_total where id = v_bill_id;
  update inventory_movements set journal_entry_id = v_entry_id where source_id = v_bill_id and journal_entry_id is null;

  return v_bill_id;
end;
$$;

drop function public.create_vendor_credit(uuid, uuid, text, date, jsonb);

create function public.create_vendor_credit(
  p_tenant_id uuid,
  p_vendor_id uuid,
  p_credit_number text,
  p_issue_date date,
  p_lines jsonb, -- [{ "itemId": uuid|null, "accountId": uuid|null, "description": text, "quantity": numeric, "unitCost": numeric }, ...]
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
  v_ap_account_id uuid;
  v_entry_id uuid;
  v_line jsonb;
  v_line_no int := 0;
  v_account_id uuid;
  v_item_id uuid;
  v_item items%rowtype;
  v_qty numeric;
  v_cost numeric;
  v_amount numeric;
  v_fifo numeric;
  v_total numeric := 0;
  v_label text;
  v_description text;
begin
  if not exists (
    select 1 from memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;

  if not exists (select 1 from contacts where id = p_vendor_id and tenant_id = p_tenant_id) then
    raise exception 'supplier % does not belong to this workspace', p_vendor_id;
  end if;
  if p_project_id is not null and not exists (select 1 from projects where id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'that project does not belong to this workspace';
  end if;
  if p_issue_date is null then
    raise exception 'a date is required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'add at least one line item';
  end if;

  select id into v_ap_account_id from accounts where tenant_id = p_tenant_id and code = '2000';
  if v_ap_account_id is null then
    raise exception 'tenant % is missing the standard Accounts Payable account (code 2000)', p_tenant_id;
  end if;

  insert into bills (tenant_id, vendor_id, project_id, bill_number, issue_date, due_date, status, document_type, created_by)
  values (p_tenant_id, p_vendor_id, p_project_id, nullif(trim(p_credit_number), ''), p_issue_date, null, 'open', 'vendor_credit', auth.uid())
  returning id into v_credit_id;

  v_label := 'Supplier credit ' || coalesce(nullif(trim(p_credit_number), ''), left(v_credit_id::text, 8));

  insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by)
  values (p_tenant_id, p_issue_date, v_label, 'vendor_credit', v_credit_id, 'posted', now(), auth.uid())
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    select o_account_id, o_item_id into v_account_id, v_item_id from _purchase_line_account(p_tenant_id, v_line, v_line_no);
    v_item := null;
    if v_item_id is not null then
      select * into v_item from items where id = v_item_id;
    end if;

    v_qty := round(coalesce((v_line->>'quantity')::numeric, 1), 2);
    v_cost := round((v_line->>'unitCost')::numeric, 2);
    if v_qty <= 0 then
      raise exception 'line % needs a quantity above zero', v_line_no;
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'line % needs an amount of zero or more', v_line_no;
    end if;

    v_amount := round(v_qty * v_cost, 2);
    v_description := coalesce(nullif(trim(v_line->>'description'), ''), v_item.name);

    insert into bill_lines (bill_id, account_id, item_id, description, quantity, unit_cost, amount, sort_order)
    values (v_credit_id, v_account_id, v_item.id, v_description, v_qty, v_cost, v_amount, v_line_no - 1);

    if v_amount > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_entry_id, v_account_id, 0, v_amount, v_description);
    end if;

    -- Goods sent back: stock leaves at FIFO cost. The credit amount already
    -- reduced Inventory Asset; any gap to the FIFO cost is trued up through COGS.
    if v_item.type = 'inventory' then
      v_fifo := _inventory_consume(p_tenant_id, v_item.id, p_issue_date, v_qty, 'purchase_return', 'vendor_credit', v_credit_id, v_label);
      if v_fifo > v_amount then
        insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
        values (v_entry_id, v_item.expense_account_id, v_fifo - v_amount, 0, 'Cost difference on returned ' || v_item.name),
               (v_entry_id, v_item.asset_account_id, 0, v_fifo - v_amount, 'Cost difference on returned ' || v_item.name);
      elsif v_amount > v_fifo then
        insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
        values (v_entry_id, v_item.asset_account_id, v_amount - v_fifo, 0, 'Cost difference on returned ' || v_item.name),
               (v_entry_id, v_item.expense_account_id, 0, v_amount - v_fifo, 'Cost difference on returned ' || v_item.name);
      end if;
    end if;

    v_total := v_total + v_amount;
  end loop;

  if v_total <= 0 then
    raise exception 'the total must be more than zero';
  end if;

  insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_entry_id, v_ap_account_id, v_total, 0, v_label);

  update bills set total = v_total, balance_due = v_total where id = v_credit_id;
  update inventory_movements set journal_entry_id = v_entry_id where source_id = v_credit_id and journal_entry_id is null;

  return v_credit_id;
end;
$$;

drop function public.post_expense_created(uuid, uuid, date, numeric, uuid, text, text, uuid);

create function public.post_expense_created(
  p_tenant_id uuid,
  p_contact_id uuid,
  p_expense_date date,
  p_amount numeric,
  p_account_id uuid, -- category / expense account
  p_payment_method text,
  p_memo text,
  p_document_id uuid default null,
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_cash_account_id uuid;
  v_entry_id uuid;
  v_amount numeric := round(p_amount, 2);
begin
  if not exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'enter an amount greater than zero';
  end if;
  if p_expense_date is null then
    raise exception 'a date is required';
  end if;
  if p_account_id is null or not exists (select 1 from accounts where id = p_account_id and tenant_id = p_tenant_id) then
    raise exception 'choose a category from this workspace';
  end if;
  if p_contact_id is not null and not exists (select 1 from contacts where id = p_contact_id and tenant_id = p_tenant_id) then
    raise exception 'that supplier does not belong to this workspace';
  end if;
  if p_project_id is not null and not exists (select 1 from projects where id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'that project does not belong to this workspace';
  end if;
  if p_document_id is not null and not exists (select 1 from documents where id = p_document_id and tenant_id = p_tenant_id) then
    raise exception 'that receipt does not belong to this workspace';
  end if;

  select id into v_cash_account_id from public.accounts where tenant_id = p_tenant_id and code = '1000';
  if v_cash_account_id is null then
    raise exception 'tenant % is missing standard Cash account (code 1000)', p_tenant_id;
  end if;

  insert into public.expenses (
    tenant_id, contact_id, project_id, expense_date, amount, account_id,
    receipt_document_id, status, payment_method, memo, created_by
  ) values (
    p_tenant_id, p_contact_id, p_project_id, p_expense_date, v_amount, p_account_id,
    p_document_id, 'posted', coalesce(p_payment_method, 'cash'), p_memo, auth.uid()
  ) returning id into v_expense_id;

  insert into public.journal_entries (
    tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by
  ) values (
    p_tenant_id, p_expense_date, coalesce(p_memo, 'Expense payment'), 'expense', v_expense_id, 'posted', now(), auth.uid()
  ) returning id into v_entry_id;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_entry_id, p_account_id, v_amount, 0, p_memo),
         (v_entry_id, v_cash_account_id, 0, v_amount, 'Cash Outflow');

  if p_document_id is not null then
    update public.documents
    set linked_expense_id = v_expense_id, status = 'posted'
    where id = p_document_id and tenant_id = p_tenant_id;
  end if;

  return v_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Stock adjustments, opening stock, re-tagging projects
-- ---------------------------------------------------------------------------
-- p_quantity is signed: +5 adds five, -2 writes two off. p_kind 'opening' books
-- the other side to Opening Balance Equity; 'adjustment' to Inventory Adjustments.
create or replace function public.adjust_inventory(
  p_tenant_id uuid,
  p_item_id uuid,
  p_date date,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reason text,
  p_kind text default 'adjustment'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item items%rowtype;
  v_qty numeric := round(p_quantity, 2);
  v_cost numeric;
  v_offset_id uuid;
  v_entry_id uuid;
  v_label text;
begin
  if not exists (
    select 1 from memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;

  select * into v_item from items where id = p_item_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'item % does not belong to this workspace', p_item_id;
  end if;
  if v_item.type <> 'inventory' then
    raise exception '"%" isn''t a stock item, so it has no quantity to adjust', v_item.name;
  end if;
  if p_kind not in ('opening', 'adjustment') then
    raise exception 'unknown adjustment kind %', p_kind;
  end if;
  if p_date is null then
    raise exception 'a date is required';
  end if;
  if v_qty is null or v_qty = 0 then
    raise exception 'enter a quantity to add or remove';
  end if;
  if p_kind = 'opening' and v_qty < 0 then
    raise exception 'opening stock must be a positive quantity';
  end if;

  v_offset_id := case p_kind
    when 'opening' then _ensure_account(p_tenant_id, '3020', 'Opening Balance Equity', 'equity', null)
    else _ensure_account(p_tenant_id, '5010', 'Inventory Adjustments', 'expense', 'cogs')
  end;

  v_label := case p_kind when 'opening' then 'Opening stock, ' else 'Stock adjustment, ' end || v_item.name
             || coalesce(' (' || nullif(trim(p_reason), '') || ')', '');

  if v_qty > 0 then
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'enter the cost per unit for the stock you''re adding';
    end if;
    v_cost := round(v_qty * p_unit_cost, 2);
    perform _inventory_receive(p_tenant_id, v_item.id, p_date, v_qty, v_cost, p_kind, 'inventory_adjustment', null, v_label);
  else
    v_cost := _inventory_consume(p_tenant_id, v_item.id, p_date, -v_qty, 'adjustment', 'inventory_adjustment', null, v_label);
  end if;

  if v_cost > 0 then
    insert into journal_entries (tenant_id, entry_date, memo, source_type, source_id, status, posted_at, created_by)
    values (p_tenant_id, p_date, v_label, 'inventory_adjustment', v_item.id, 'posted', now(), auth.uid())
    returning id into v_entry_id;

    if v_qty > 0 then
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_entry_id, v_item.asset_account_id, v_cost, 0, v_label),
             (v_entry_id, v_offset_id, 0, v_cost, v_label);
    else
      insert into journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
      values (v_entry_id, v_offset_id, v_cost, 0, v_label),
             (v_entry_id, v_item.asset_account_id, 0, v_cost, v_label);
    end if;

    update inventory_movements set journal_entry_id = v_entry_id
     where item_id = v_item.id and source_type = 'inventory_adjustment' and journal_entry_id is null
       and created_at = now();
  end if;

  return v_entry_id;
end;
$$;

-- Tag (or untag) an existing document with a project. Metadata only: no GL change.
create or replace function public.set_document_project(
  p_tenant_id uuid,
  p_document_kind text, -- 'sales' | 'purchase' | 'expense'
  p_document_id uuid,
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not authorized for this tenant';
  end if;
  if p_project_id is not null and not exists (select 1 from projects where id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'that project does not belong to this workspace';
  end if;

  if p_document_kind = 'sales' then
    update invoices set project_id = p_project_id where id = p_document_id and tenant_id = p_tenant_id;
  elsif p_document_kind = 'purchase' then
    update bills set project_id = p_project_id where id = p_document_id and tenant_id = p_tenant_id;
  elsif p_document_kind = 'expense' then
    update expenses set project_id = p_project_id where id = p_document_id and tenant_id = p_tenant_id;
  else
    raise exception 'unknown document kind %', p_document_kind;
  end if;

  if not found then
    raise exception 'document % not found in this workspace', p_document_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Project roll-up
-- ---------------------------------------------------------------------------
-- Revenue: issued invoices, debit notes and sales receipts net of refunds (pre-tax).
-- Costs: bills net of supplier credits, posted expenses, and the FIFO cost of
-- stock sold on the project's own sales documents.
create view public.project_financials with (security_invoker = true) as
select
  p.id as project_id,
  p.tenant_id,
  coalesce(rev.amount, 0)::numeric(14, 2) as revenue,
  (coalesce(pur.amount, 0) + coalesce(exp.amount, 0) + coalesce(cogs.amount, 0))::numeric(14, 2) as costs,
  (coalesce(rev.amount, 0) - coalesce(pur.amount, 0) - coalesce(exp.amount, 0) - coalesce(cogs.amount, 0))::numeric(14, 2) as profit,
  coalesce(rev.outstanding, 0)::numeric(14, 2) as receivable
from public.projects p
left join lateral (
  select
    sum(case when i.document_type = 'refund_receipt' then -i.subtotal else i.subtotal end) as amount,
    sum(case when i.document_type in ('invoice', 'debit_note') then i.balance_due else 0 end) as outstanding
  from public.invoices i
  where i.project_id = p.id and i.status not in ('draft', 'void')
) rev on true
left join lateral (
  select sum(case when b.document_type = 'vendor_credit' then -b.total else b.total end) as amount
  from public.bills b
  where b.project_id = p.id and b.status <> 'void'
) pur on true
left join lateral (
  select sum(e.amount) as amount from public.expenses e where e.project_id = p.id and e.status = 'posted'
) exp on true
left join lateral (
  select -sum(m.total_cost) as amount
  from public.inventory_movements m
  join public.invoices i on i.id = m.source_id
  where i.project_id = p.id and m.movement_type in ('sale', 'sale_return')
) cogs on true;

grant select on public.project_financials to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke execute on function public._ensure_account(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public._inventory_receive(uuid, uuid, date, numeric, numeric, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public._inventory_consume(uuid, uuid, date, numeric, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public._post_sales_document_inventory(uuid) from public, anon, authenticated;
revoke execute on function public._purchase_line_account(uuid, jsonb, int) from public, anon, authenticated;
revoke execute on function public.items_before_write() from public, anon, authenticated;

revoke execute on function public.update_workspace_profile(uuid, text, text, text, text, text, text, jsonb, int, text, text, numeric, text, text) from public, anon;
revoke execute on function public.create_sales_document(uuid, uuid, text, date, date, text, text, jsonb, uuid) from public, anon;
revoke execute on function public.post_invoice_issued(uuid) from public, anon;
revoke execute on function public.create_bill_received(uuid, uuid, text, date, date, jsonb, uuid) from public, anon;
revoke execute on function public.create_vendor_credit(uuid, uuid, text, date, jsonb, uuid) from public, anon;
revoke execute on function public.post_expense_created(uuid, uuid, date, numeric, uuid, text, text, uuid, uuid) from public, anon;
revoke execute on function public.adjust_inventory(uuid, uuid, date, numeric, numeric, text, text) from public, anon;
revoke execute on function public.set_document_project(uuid, text, uuid, uuid) from public, anon;

grant execute on function public.update_workspace_profile(uuid, text, text, text, text, text, text, jsonb, int, text, text, numeric, text, text) to authenticated;
grant execute on function public.create_sales_document(uuid, uuid, text, date, date, text, text, jsonb, uuid) to authenticated;
grant execute on function public.post_invoice_issued(uuid) to authenticated;
grant execute on function public.create_bill_received(uuid, uuid, text, date, date, jsonb, uuid) to authenticated;
grant execute on function public.create_vendor_credit(uuid, uuid, text, date, jsonb, uuid) to authenticated;
grant execute on function public.post_expense_created(uuid, uuid, date, numeric, uuid, text, text, uuid, uuid) to authenticated;
grant execute on function public.adjust_inventory(uuid, uuid, date, numeric, numeric, text, text) to authenticated;
grant execute on function public.set_document_project(uuid, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Membership privilege escalation fix
-- ---------------------------------------------------------------------------
-- "memberships_update_self_accept" let any member UPDATE their own membership
-- row with no column limits — a staff or viewer could set role = 'owner' (or
-- un-suspend themselves) straight through the REST API. Accepting an invite
-- already goes through accept_invite() (SECURITY DEFINER), so the policy is
-- dropped. The trigger below also stops admins from minting owners: only an
-- active owner may grant, change or revoke the owner role, the last owner can't
-- be demoted, and a membership can never move to another user or workspace.
drop policy if exists "memberships_update_self_accept" on public.memberships;

create or replace function public.memberships_guard_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_is_owner boolean;
begin
  -- service-role / definer maintenance (no end user) is trusted
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  v_actor_is_owner := exists (
    select 1 from memberships
     where tenant_id = coalesce(new.tenant_id, old.tenant_id) and user_id = auth.uid()
       and status = 'active' and role = 'owner'
  );

  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id or new.user_id <> old.user_id then
      raise exception 'a membership can''t be moved to another person or workspace';
    end if;
    if (new.role = 'owner') <> (old.role = 'owner') and not v_actor_is_owner then
      raise exception 'only an owner can grant or remove the owner role';
    end if;
    if old.role = 'owner' and new.role <> 'owner' and old.status = 'active' and not exists (
      select 1 from memberships
       where tenant_id = old.tenant_id and id <> old.id and role = 'owner' and status = 'active'
    ) then
      raise exception 'a workspace needs at least one owner — make someone else an owner first';
    end if;
    return new;
  elsif tg_op = 'INSERT' then
    -- a brand-new workspace's first member (create_tenant) becomes its owner
    if new.role = 'owner' and not v_actor_is_owner
       and exists (select 1 from memberships where tenant_id = new.tenant_id) then
      raise exception 'only an owner can add another owner';
    end if;
    return new;
  else -- DELETE
    if old.role = 'owner' and not v_actor_is_owner then
      raise exception 'only an owner can remove an owner';
    end if;
    if old.role = 'owner' and old.status = 'active' and not exists (
      select 1 from memberships
       where tenant_id = old.tenant_id and id <> old.id and role = 'owner' and status = 'active'
    ) then
      raise exception 'a workspace needs at least one owner — make someone else an owner first';
    end if;
    return old;
  end if;
end;
$$;

create trigger memberships_guard_roles
  before insert or update or delete on public.memberships
  for each row execute function public.memberships_guard_roles();

revoke execute on function public.memberships_guard_roles() from public, anon, authenticated;
