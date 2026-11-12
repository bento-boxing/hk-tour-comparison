create table operators (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  site_url text not null,
  color text not null,
  last_good_run_at timestamptz
);
insert into operators (id, name_zh, name_en, site_url, color) values
  ('egl',     '東瀛遊',   'EGL Tours',        'https://www.egltours.com',  '#d62839'),
  ('jetour',  '捷旅',     'Jetour',           'https://www.jetour.com.hk', '#ee7b06'),
  ('texpert', '專業旅運', 'Travel Expert',    'https://www.texpert.com',   '#7d3cc8'),
  ('bigline', '大航假期', 'Big Line Holiday', 'https://www.bigline.hk',    '#2a9d4b');

create table tours (
  id bigint generated always as identity primary key,
  operator_id text not null references operators(id),
  code text not null,
  url text not null,
  title text not null,
  days int not null check (days between 1 and 60),
  nights int,
  from_price_hkd int not null check (from_price_hkd >= 100),
  start_kind text not null check (start_kind in ('hk','sz','other')),
  start_label text,
  end_kind text not null check (end_kind in ('hk','sz','other')),
  end_label text,
  active boolean not null default true,
  first_seen date not null,
  last_seen date not null,
  unique (operator_id, code)
);
create index tours_active_idx on tours (active, from_price_hkd);

create table tour_stops (
  tour_id bigint not null references tours(id) on delete cascade,
  position int not null,
  country_id text not null,
  region_id text not null,
  city_id text,
  primary key (tour_id, position)
);
create index tour_stops_region_idx on tour_stops (region_id);
create index tour_stops_country_idx on tour_stops (country_id);

create table departures (
  tour_id bigint not null references tours(id) on delete cascade,
  date date not null,
  price_hkd int check (price_hkd is null or price_hkd >= 100),
  primary key (tour_id, date)
);
create index departures_date_idx on departures (date);

create table price_snapshots (
  tour_id bigint not null references tours(id) on delete cascade,
  date date not null,
  price_hkd int not null,
  primary key (tour_id, date)
);

create table scrape_runs (
  id bigint generated always as identity primary key,
  operator_id text not null references operators(id),
  run_date date not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  pages_fetched int not null,
  tours_saved int not null,
  parse_failures int not null,
  ok boolean not null,
  reasons text[] not null default '{}'
);
create index scrape_runs_operator_idx on scrape_runs (operator_id, run_date desc);

create table unmatched_places (
  operator_id text not null references operators(id),
  name text not null,
  example_tour_code text not null,
  seen_count int not null default 1,
  last_seen date not null,
  primary key (operator_id, name)
);

alter table operators        enable row level security;
alter table tours            enable row level security;
alter table tour_stops       enable row level security;
alter table departures       enable row level security;
alter table price_snapshots  enable row level security;
alter table scrape_runs      enable row level security;
alter table unmatched_places enable row level security;
