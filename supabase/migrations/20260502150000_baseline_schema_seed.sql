-- Baseline schema + policies + seed data + pricing.
-- This file squashes previous migrations into a single bootstrap migration.


-- ===== BEGIN 20260429115231_789aaff1-3c2f-4073-af67-426428b1805d.sql =====


-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_code TEXT NOT NULL,
  placed TEXT NOT NULL,
  eta TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Order placed',
  progress INT NOT NULL DEFAULT 0,
  address TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal INT NOT NULL DEFAULT 0,
  shipping INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  rider JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- ===== END 20260429115231_789aaff1-3c2f-4073-af67-426428b1805d.sql =====


-- ===== BEGIN 20260429115258_3ef068eb-13d4-40aa-9d67-901191815bb1.sql =====

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ===== END 20260429115258_3ef068eb-13d4-40aa-9d67-901191815bb1.sql =====


-- ===== BEGIN 20260429120000_products-table.sql =====

-- Products table
CREATE TABLE public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  cat TEXT NOT NULL DEFAULT 'monitoring',
  price INTEGER NOT NULL,
  was INTEGER,
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  stock TEXT NOT NULL DEFAULT 'In stock',
  tags TEXT[] NOT NULL DEFAULT '{}',
  blurb TEXT NOT NULL DEFAULT '',
  swatch TEXT NOT NULL DEFAULT 'emerald',
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone can read active products (public catalog)
CREATE POLICY "Products are publicly readable" ON public.products
  FOR SELECT USING (active = true);

-- Only service role can insert/update/delete (admin operations)
CREATE POLICY "Service role can manage products" ON public.products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed all products
INSERT INTO public.products (id, name, brand, cat, price, was, rating, reviews, stock, tags, blurb, swatch, sort_order) VALUES
  ('p01', 'Digital Glucometer Kit',          'Accu-Sense',    'monitoring',   3290,  3990, 4.7, 312,  'In stock',   ARRAY['Top rated','Best seller'], '5-second readings, 25 free strips included.',            'emerald', 1),
  ('p02', 'Automatic BP Monitor',            'Omtek BP-9',    'monitoring',   5450,  6200, 4.8, 514,  'In stock',   ARRAY['Best seller'],              'Upper arm, dual-user memory, irregular heartbeat alert.', 'sky',     2),
  ('p03', 'Pulse Oximeter (Fingertip)',       'OxyPro',        'monitoring',   1890,  2400, 4.6, 1208, 'In stock',   ARRAY['Top rated'],                'SpO₂ + pulse rate, OLED display, auto-shutoff.',         'sky',     3),
  ('p04', 'Digital Body Weight Scale',       'Health+ S2',    'monitoring',   2390,  NULL, 4.4, 201,  'In stock',   ARRAY[]::TEXT[],                   'Tempered glass, 180kg capacity, step-on tech.',          'slate',   4),
  ('p05', 'Infrared Forehead Thermometer',   'ThermoTouch',   'monitoring',   2490,  2990, 4.5, 402,  'In stock',   ARRAY['Deal'],                     '1-second read, fever alarm, no contact.',                'rose',    5),
  ('p06', 'Electronic Stethoscope',          'CardioLite',    'monitoring',   8990,  NULL, 4.9, 88,   'Low stock',  ARRAY['Pro pick'],                 '24x amplification, dual-head, professional grade.',      'slate',   6),
  ('p07', 'Hearing Aid (Rechargeable)',       'ClearTone',     'monitoring',   11400, 13500,4.3, 142,  'In stock',   ARRAY['Deal'],                     'Behind-the-ear, 18hr battery, noise reduction.',         'amber',   7),
  ('p08', 'Diabetes Test Strips (50ct)',      'Accu-Sense',    'consumables',  1290,  NULL, 4.6, 980,  'In stock',   ARRAY['Refill'],                   'Compatible with Accu-Sense glucometers.',                'emerald', 8),
  ('p09', 'Compressor Nebulizer',            'AirMed N3',     'respiratory',  4290,  4990, 4.7, 267,  'In stock',   ARRAY['Best seller'],              'Quiet operation, child + adult masks included.',         'sky',     9),
  ('p10', 'Oxygen Concentrator 5L',          'BreathePro',    'respiratory',  124900,NULL, 4.8, 46,   'Limited',    ARRAY['Premium'],                  '5L/min continuous, low noise, mobility wheels.',         'sky',     10),
  ('p11', 'Portable Oxygen Cylinder',        'BreathePro',    'respiratory',  18900, NULL, 4.5, 73,   'In stock',   ARRAY[]::TEXT[],                   '2.8L lightweight, regulator + carry bag.',               'slate',   11),
  ('p12', 'Suction Machine',                 'VacuMed',       'respiratory',  14800, NULL, 4.4, 38,   'In stock',   ARRAY[]::TEXT[],                   'Adjustable vacuum, 1L canister, AC + DC.',               'slate',   12),
  ('p13', 'Facial Steamer',                  'AirMed',        'respiratory',  2790,  NULL, 4.2, 115,  'In stock',   ARRAY[]::TEXT[],                   'Warm mist for sinus & skin care.',                       'rose',    13),
  ('p14', 'Lightweight Folding Wheelchair',  'MoveEase',      'mobility',     21900, 24500,4.6, 78,   'In stock',   ARRAY['Deal'],                     '100kg capacity, folds flat, swing-away footrests.',      'emerald', 14),
  ('p15', 'Aluminium Patient Walker',        'StepRight',     'mobility',     5490,  NULL, 4.5, 142,  'In stock',   ARRAY[]::TEXT[],                   'Adjustable height, foldable, anti-slip grips.',          'slate',   15),
  ('p16', 'Adjustable Walking Stick',        'StepRight',     'mobility',     1490,  NULL, 4.3, 301,  'In stock',   ARRAY[]::TEXT[],                   'Aluminium, ergonomic grip, 9 height settings.',          'amber',   16),
  ('p17', 'Bedside Commode Chair',           'CareSeat',      'mobility',     6990,  NULL, 4.4, 54,   'In stock',   ARRAY[]::TEXT[],                   'Padded seat, removable bucket, adjustable legs.',        'slate',   17),
  ('p18', 'Folding Shower Chair',            'CareSeat',      'mobility',     4490,  NULL, 4.5, 91,   'In stock',   ARRAY[]::TEXT[],                   'Anti-slip rubber feet, drainage holes.',                 'sky',     18),
  ('p19', 'Anti-Bedsore Air Mattress',       'ComfortRest',   'patient-care', 7990,  9200, 4.5, 122,  'In stock',   ARRAY['Deal'],                     'Alternating pressure, silent pump, 130kg.',              'sky',     19),
  ('p20', 'Adjustable Patient Food Trolley', 'BedMate',       'patient-care', 6490,  NULL, 4.4, 33,   'In stock',   ARRAY[]::TEXT[],                   'Tilting top, height adjust, 4 lockable wheels.',         'slate',   20),
  ('p21', 'Adult Diapers (L, 10ct)',         'DryDay',        'consumables',  990,   NULL, 4.6, 678,  'In stock',   ARRAY['Refill'],                   '12hr absorbency, soft non-woven cover.',                 'emerald', 21),
  ('p22', 'Urine Drainage Bag (2L)',         'MediFlow',      'consumables',  290,   NULL, 4.4, 218,  'In stock',   ARRAY[]::TEXT[],                   'Anti-reflux valve, pre-attached tubing.',                'amber',   22),
  ('p23', 'Electric Breast Pump',            'NurtureFlow',   'patient-care', 8490,  NULL, 4.7, 165,  'In stock',   ARRAY['Top rated'],                '9 modes, rechargeable, BPA-free.',                       'rose',    23),
  ('p24', 'Heating Pad (Large)',             'WarmCare',      'therapy',      1990,  NULL, 4.5, 430,  'In stock',   ARRAY[]::TEXT[],                   '6 heat levels, auto shut-off, machine washable.',        'rose',    24),
  ('p25', 'Hot & Cold Gel Pack Set',         'WarmCare',      'therapy',      790,   NULL, 4.6, 512,  'In stock',   ARRAY['Refill'],                   'Reusable, microwavable, freezer safe.',                  'sky',     25),
  ('p26', 'TENS Machine (Dual Channel)',     'PulseTherapy',  'therapy',      5490,  6900, 4.7, 198,  'In stock',   ARRAY['Deal'],                     '15 modes, 8 electrodes, rechargeable.',                  'emerald', 26),
  ('p27', 'Cordless Body Massager',          'RelaxPro',      'therapy',      4290,  NULL, 4.4, 287,  'In stock',   ARRAY[]::TEXT[],                   '6 nodes, 3 speeds, 2hr battery.',                        'slate',   27),
  ('p28', 'Anti-Burst Gym Ball (65cm)',      'FlexCore',      'therapy',      1690,  NULL, 4.5, 156,  'In stock',   ARRAY[]::TEXT[],                   'Includes pump, 300kg burst rating.',                     'amber',   28),
  ('p29', 'Examination Gloves (100ct)',      'PureFit',       'consumables',  790,   NULL, 4.5, 1102, 'In stock',   ARRAY['Refill','Bulk'],            'Latex-free, powder-free, medium.',                       'sky',     29),
  ('p30', '3-Ply Surgical Masks (50ct)',     'PureFit',       'consumables',  390,   NULL, 4.4, 1640, 'In stock',   ARRAY['Refill'],                   'BFE 99%, soft ear loops.',                              'emerald', 30),
  ('p31', 'Disposable Syringe (10ml, 100ct)','MediFlow',      'consumables',  1290,  NULL, 4.5, 204,  'In stock',   ARRAY['Bulk'],                     'Sterile, single use, latex-free gasket.',                'slate',   31);


-- ===== END 20260429120000_products-table.sql =====


-- ===== BEGIN 20260429134000_admin-roles-and-policies.sql =====

-- Add roles to profiles for admin authorization
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

-- Ensure any legacy/null values are normalized
UPDATE public.profiles
SET role = 'customer'
WHERE role IS NULL OR role = '';

-- Function used by RLS policies to check admin/staff access
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'staff')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Product policies: admins can fully manage products
DROP POLICY IF EXISTS "Admins can read all products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Admins can read all products"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Order policies: admins can review and manage all orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;

CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update all orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ===== END 20260429134000_admin-roles-and-policies.sql =====


-- ===== BEGIN 20260430120000_categories-and-products-seed.sql =====

-- Migration: Add categories table and reseed products from Excel data

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage categories" ON public.categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Add category_id FK to products (references categories)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id);

-- 3. Seed categories
INSERT INTO public.categories (id, name, slug, sort_order) VALUES
  ('cat-glucometers',          'Glucometers',            'glucometers',          1),
  ('cat-bp-digital',           'BP Digital',             'bp-digital',           2),
  ('cat-bp-manual',            'BP Manual',              'bp-manual',            3),
  ('cat-weight-scale-digital', 'Weight Scale Digital',   'weight-scale-digital', 4),
  ('cat-weight-scale-manual',  'Weight Scale Manual',    'weight-scale-manual',  5),
  ('cat-camote-chairs',        'Imported Camote Chairs', 'camote-chairs',        6),
  ('cat-walkers',              'Imported Walkers',       'walkers',              7),
  ('cat-patient-sticks',       'Patient Sticks',         'patient-sticks',       8),
  ('cat-wheelchairs',          'Wheel Chairs',           'wheelchairs',          9),
  ('cat-sugar-strips',         'Sugar Strips',           'sugar-strips',         10),
  ('cat-hearing-aids',         'Hearing Aids',           'hearing-aids',         11),
  ('cat-heating-pad',          'Heating Pad',            'heating-pad',          12),
  ('cat-air-mattress',         'Air Mattress',           'air-mattress',         13),
  ('cat-tens-machine',         'Tens Machine',           'tens-machine',         14),
  ('cat-nebulizer',            'Nebulizer',              'nebulizer',            15),
  ('cat-stethoscope',          'Stethoscope',            'stethoscope',          16),
  ('cat-massagers',            'Massagers',              'massagers',            17),
  ('cat-ortho-belts',          'Ortho Belts',            'ortho-belts',          18),
  ('cat-supports',             'Supports',               'supports',             19),
  ('cat-breast-pump',          'Breast Pump',            'breast-pump',          20),
  ('cat-steamers',             'Steamers',               'steamers',             21),
  ('cat-suction-machine',      'Suction Machine',        'suction-machine',      22),
  ('cat-other',                'Other Items',            'other',                23)
ON CONFLICT (id) DO NOTHING;

-- 4. Delete all existing products
DELETE FROM public.products;

-- 5. Seed new products from Excel data
--    cat = slug (for backward-compat text filtering)
--    category_id = FK to categories table
--    price = purchase amount where available, else 0
INSERT INTO public.products
  (id, name, brand, cat, category_id, price, sort_order, swatch, stock, rating, reviews, tags, blurb)
VALUES
  -- Glucometers
  ('gluco-001',  'Accu Check Active',                  '', 'glucometers',          'cat-glucometers',          0,    1,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-002',  'Accu Check Instant',                 '', 'glucometers',          'cat-glucometers',          0,    2,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-003',  'Accu Check Instant S',               '', 'glucometers',          'cat-glucometers',          0,    3,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-004',  'Evo Check Go',                       '', 'glucometers',          'cat-glucometers',          1700, 4,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-005',  'On Call',                            '', 'glucometers',          'cat-glucometers',          0,    5,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-006',  'On Call Extra',                      '', 'glucometers',          'cat-glucometers',          0,    6,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-007',  'Atom',                               '', 'glucometers',          'cat-glucometers',          0,    7,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-008',  'Master',                             '', 'glucometers',          'cat-glucometers',          700,  8,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-009',  'Medisign',                           '', 'glucometers',          'cat-glucometers',          0,    9,   'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-010',  'Evo Check',                          '', 'glucometers',          'cat-glucometers',          3400, 10,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('gluco-011',  'Life Check',                         '', 'glucometers',          'cat-glucometers',          0,    11,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),

  -- BP Digital
  ('bp-dig-001', 'Omron M1',                           '', 'bp-digital',           'cat-bp-digital',           0,    12,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-002', 'Medisign 804',                       '', 'bp-digital',           'cat-bp-digital',           0,    13,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-003', 'Medisign 830',                       '', 'bp-digital',           'cat-bp-digital',           0,    14,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-004', 'Medisign BPM 36',                    '', 'bp-digital',           'cat-bp-digital',           0,    15,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-005', 'Medicare 631A',                      '', 'bp-digital',           'cat-bp-digital',           0,    16,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-006', 'Medicare 814',                       '', 'bp-digital',           'cat-bp-digital',           0,    17,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-007', 'Atom 704',                           '', 'bp-digital',           'cat-bp-digital',           0,    18,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-008', 'Ucheck 8008',                        '', 'bp-digital',           'cat-bp-digital',           0,    19,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-009', 'Certeza BP 450',                     '', 'bp-digital',           'cat-bp-digital',           0,    20,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-010', 'ABM BP Monitor',                     '', 'bp-digital',           'cat-bp-digital',           0,    21,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-dig-011', 'Life Check 6250',                    '', 'bp-digital',           'cat-bp-digital',           0,    22,  'sky',     'In stock', 0, 0, '{}'::text[], ''),

  -- BP Manual
  ('bp-man-001', 'Yuwell',                             '', 'bp-manual',            'cat-bp-manual',            0,    23,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-002', 'Atom',                               '', 'bp-manual',            'cat-bp-manual',            0,    24,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-003', 'Medisign',                           '', 'bp-manual',            'cat-bp-manual',            0,    25,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-004', 'Certeza',                            '', 'bp-manual',            'cat-bp-manual',            0,    26,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-005', 'ABM',                                '', 'bp-manual',            'cat-bp-manual',            0,    27,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-006', 'Senior',                             '', 'bp-manual',            'cat-bp-manual',            0,    28,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-007', 'Master',                             '', 'bp-manual',            'cat-bp-manual',            0,    29,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('bp-man-008', 'Certeza Aneroid Blue',               '', 'bp-manual',            'cat-bp-manual',            0,    30,  'sky',     'In stock', 0, 0, '{}'::text[], ''),

  -- Weight Scale Digital
  ('wsd-001',    'Camry',                              '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    31,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-002',    'Life Care',                          '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    32,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-003',    'Kitchen Scale',                      '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    33,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-004',    'Evo Check',                          '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    34,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-005',    'Certeza',                            '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    35,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-006',    'Blevia',                             '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    36,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-007',    'Baby Weight Scale',                  '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    37,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsd-008',    'Senior',                             '', 'weight-scale-digital',  'cat-weight-scale-digital', 0,    38,  'slate',   'In stock', 0, 0, '{}'::text[], ''),

  -- Weight Scale Manual
  ('wsm-001',    'Camry',                              '', 'weight-scale-manual',   'cat-weight-scale-manual',  0,    39,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsm-002',    'Life Care',                          '', 'weight-scale-manual',   'cat-weight-scale-manual',  0,    40,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsm-003',    'Evo Check',                          '', 'weight-scale-manual',   'cat-weight-scale-manual',  0,    41,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsm-004',    'Certeza',                            '', 'weight-scale-manual',   'cat-weight-scale-manual',  0,    42,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsm-005',    'Blevia',                             '', 'weight-scale-manual',   'cat-weight-scale-manual',  0,    43,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wsm-006',    'Senior',                             '', 'weight-scale-manual',   'cat-weight-scale-manual',  0,    44,  'slate',   'In stock', 0, 0, '{}'::text[], ''),

  -- Imported Camote Chairs
  ('cc-001',     'Secure Camote Chair',                '', 'camote-chairs',         'cat-camote-chairs',        0,    45,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-002',     'Life Care Camote Chair',             '', 'camote-chairs',         'cat-camote-chairs',        0,    46,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-003',     'Secure Camote Chair Wheel',          '', 'camote-chairs',         'cat-camote-chairs',        0,    47,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-004',     'Life Care Camote Chair Wheel',       '', 'camote-chairs',         'cat-camote-chairs',        0,    48,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-005',     'Secure Shower Chair',                '', 'camote-chairs',         'cat-camote-chairs',        0,    49,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-006',     'Life Care Shower Chair',             '', 'camote-chairs',         'cat-camote-chairs',        0,    50,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-007',     'Secure Shower Chair Wheel',          '', 'camote-chairs',         'cat-camote-chairs',        0,    51,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-008',     'Life Care Shower Chair Wheel',       '', 'camote-chairs',         'cat-camote-chairs',        0,    52,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-009',     'Secure Camote Raiser',               '', 'camote-chairs',         'cat-camote-chairs',        0,    53,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('cc-010',     'Life Care Camote Raiser',            '', 'camote-chairs',         'cat-camote-chairs',        0,    54,  'amber',   'In stock', 0, 0, '{}'::text[], ''),

  -- Imported Walkers
  ('wlk-001',    'Secure Walker Plain',                '', 'walkers',               'cat-walkers',              0,    55,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('wlk-002',    'Life Care Walker Plain',             '', 'walkers',               'cat-walkers',              0,    56,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('wlk-003',    'Secure Walker Wheel',                '', 'walkers',               'cat-walkers',              0,    57,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('wlk-004',    'Life Care Walker Wheel',             '', 'walkers',               'cat-walkers',              0,    58,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('wlk-005',    'Rollator',                           '', 'walkers',               'cat-walkers',              0,    59,  'amber',   'In stock', 0, 0, '{}'::text[], ''),

  -- Patient Sticks
  ('stick-001',  'Tripod Stick',                       '', 'patient-sticks',        'cat-patient-sticks',       0,    60,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('stick-002',  'Elbow Stick',                        '', 'patient-sticks',        'cat-patient-sticks',       0,    61,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('stick-003',  'Trusty Cane Stick Foldable',         '', 'patient-sticks',        'cat-patient-sticks',       0,    62,  'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('stick-004',  'Besaki',                             '', 'patient-sticks',        'cat-patient-sticks',       0,    63,  'amber',   'In stock', 0, 0, '{}'::text[], ''),

  -- Wheel Chairs
  ('wc-001',     'Wheel Chair 809 (Secure & Life Care)',    '', 'wheelchairs',      'cat-wheelchairs',          0,    64,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wc-002',     'Wheel Chair BMW (Secure & Life Care)',    '', 'wheelchairs',      'cat-wheelchairs',          0,    65,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wc-003',     'Wheel Chair 868 (Secure & Life Care)',    '', 'wheelchairs',      'cat-wheelchairs',          0,    66,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wc-004',     'Wheel Chair Aclined (Secure & Life Care)', '', 'wheelchairs',     'cat-wheelchairs',          0,    67,  'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('wc-005',     'Electric Wheel Chair (Secure & Life Care)', '', 'wheelchairs',    'cat-wheelchairs',          0,    68,  'slate',   'In stock', 0, 0, '{}'::text[], ''),

  -- Sugar Strips
  ('strip-001',  'Atom',                               '', 'sugar-strips',          'cat-sugar-strips',         0,    69,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-002',  'Accu Check Active',                  '', 'sugar-strips',          'cat-sugar-strips',         0,    70,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-003',  'Accu Check Instant',                 '', 'sugar-strips',          'cat-sugar-strips',         0,    71,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-004',  'Free Style',                         '', 'sugar-strips',          'cat-sugar-strips',         2100, 72,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-005',  'Ucheck',                             '', 'sugar-strips',          'cat-sugar-strips',         0,    73,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-006',  'Master',                             '', 'sugar-strips',          'cat-sugar-strips',         0,    74,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-007',  'Evo Check Go',                       '', 'sugar-strips',          'cat-sugar-strips',         1800, 75,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-008',  'Medisign',                           '', 'sugar-strips',          'cat-sugar-strips',         0,    76,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-009',  'Accu Check Performa',                '', 'sugar-strips',          'cat-sugar-strips',         0,    77,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('strip-010',  'Oncall',                             '', 'sugar-strips',          'cat-sugar-strips',         0,    78,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),

  -- Hearing Aids
  ('hear-001',   'Axon V 163',                         '', 'hearing-aids',          'cat-hearing-aids',         0,    79,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('hear-002',   'Axon K 86',                          '', 'hearing-aids',          'cat-hearing-aids',         0,    80,  'rose',    'In stock', 0, 0, '{}'::text[], ''),

  -- Heating Pad
  ('heat-001',   'Atom',                               '', 'heating-pad',           'cat-heating-pad',          0,    81,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('heat-002',   'Ucheck',                             '', 'heating-pad',           'cat-heating-pad',          0,    82,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('heat-003',   'Medicare',                           '', 'heating-pad',           'cat-heating-pad',          0,    83,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('heat-004',   'ABM',                                '', 'heating-pad',           'cat-heating-pad',          0,    84,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('heat-005',   'Certeza',                            '', 'heating-pad',           'cat-heating-pad',          0,    85,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('heat-006',   'Accu Max',                           '', 'heating-pad',           'cat-heating-pad',          0,    86,  'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('heat-007',   'Life Care',                          '', 'heating-pad',           'cat-heating-pad',          0,    87,  'rose',    'In stock', 0, 0, '{}'::text[], ''),

  -- Air Mattress
  ('am-001',     'Atom',                               '', 'air-mattress',          'cat-air-mattress',         0,    88,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('am-002',     'Ucheck',                             '', 'air-mattress',          'cat-air-mattress',         0,    89,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('am-003',     'Medicare',                           '', 'air-mattress',          'cat-air-mattress',         0,    90,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('am-004',     'Certeza',                            '', 'air-mattress',          'cat-air-mattress',         0,    91,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('am-005',     'Accu Max',                           '', 'air-mattress',          'cat-air-mattress',         0,    92,  'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('am-006',     'Life Care',                          '', 'air-mattress',          'cat-air-mattress',         0,    93,  'sky',     'In stock', 0, 0, '{}'::text[], ''),

  -- Tens Machine
  ('tens-001',   'Blue Idea Tens 610',                 '', 'tens-machine',          'cat-tens-machine',         0,    94,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('tens-002',   'Electronic Plus Tens',               '', 'tens-machine',          'cat-tens-machine',         0,    95,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('tens-003',   'Basemed Tens 660',                   '', 'tens-machine',          'cat-tens-machine',         0,    96,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('tens-004',   'Senior Tens 92660',                  '', 'tens-machine',          'cat-tens-machine',         0,    97,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('tens-005',   'Blue Idea Tens 2008b',               '', 'tens-machine',          'cat-tens-machine',         0,    98,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),
  ('tens-006',   'Life Care Combo Stim EMS',           '', 'tens-machine',          'cat-tens-machine',         0,    99,  'emerald', 'In stock', 0, 0, '{}'::text[], ''),

  -- Nebulizer
  ('neb-001',    'Ucheck',                             '', 'nebulizer',             'cat-nebulizer',            0,    100, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-002',    'Life Care',                          '', 'nebulizer',             'cat-nebulizer',            0,    101, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-003',    'Medicare',                           '', 'nebulizer',             'cat-nebulizer',            0,    102, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-004',    'Medicare Plus',                      '', 'nebulizer',             'cat-nebulizer',            0,    103, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-005',    'Active',                             '', 'nebulizer',             'cat-nebulizer',            0,    104, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-006',    'Apple Neb',                          '', 'nebulizer',             'cat-nebulizer',            0,    105, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-007',    'Strong Neb',                         '', 'nebulizer',             'cat-nebulizer',            0,    106, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-008',    'Micelflux',                          '', 'nebulizer',             'cat-nebulizer',            0,    107, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-009',    'Baby Neb',                           '', 'nebulizer',             'cat-nebulizer',            0,    108, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-010',    'Mesh Portable Nebulizer',            '', 'nebulizer',             'cat-nebulizer',            0,    109, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('neb-011',    'Atom',                               '', 'nebulizer',             'cat-nebulizer',            0,    110, 'sky',     'In stock', 0, 0, '{}'::text[], ''),

  -- Stethoscope
  ('steth-001',  'Littmann Classic',                   '', 'stethoscope',           'cat-stethoscope',          0,    111, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-002',  'Certeza',                            '', 'stethoscope',           'cat-stethoscope',          0,    112, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-003',  'Atom',                               '', 'stethoscope',           'cat-stethoscope',          0,    113, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-004',  'Ucheck',                             '', 'stethoscope',           'cat-stethoscope',          0,    114, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-005',  'Senior',                             '', 'stethoscope',           'cat-stethoscope',          0,    115, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-006',  'Medico',                             '', 'stethoscope',           'cat-stethoscope',          0,    116, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-007',  'Life Care',                          '', 'stethoscope',           'cat-stethoscope',          0,    117, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-008',  'Medicare',                           '', 'stethoscope',           'cat-stethoscope',          0,    118, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-009',  'Blevia',                             '', 'stethoscope',           'cat-stethoscope',          0,    119, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-010',  'Yuwell',                             '', 'stethoscope',           'cat-stethoscope',          0,    120, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('steth-011',  'Medi Plus',                          '', 'stethoscope',           'cat-stethoscope',          0,    121, 'slate',   'In stock', 0, 0, '{}'::text[], ''),

  -- Massagers
  ('mass-001',   'Gun Massager',                       '', 'massagers',             'cat-massagers',            0,    122, 'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('mass-002',   'Magic Massager',                     '', 'massagers',             'cat-massagers',            0,    123, 'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('mass-003',   'Tikon Massager',                     '', 'massagers',             'cat-massagers',            0,    124, 'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('mass-004',   'Heated Massager',                    '', 'massagers',             'cat-massagers',            0,    125, 'amber',   'In stock', 0, 0, '{}'::text[], ''),
  ('mass-005',   'Double Head Massager',               '', 'massagers',             'cat-massagers',            0,    126, 'amber',   'In stock', 0, 0, '{}'::text[], ''),

  -- Ortho Belts
  ('belt-001',   'Sacro Belt',                         '', 'ortho-belts',           'cat-ortho-belts',          0,    127, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-002',   'Sacral Belt',                        '', 'ortho-belts',           'cat-ortho-belts',          0,    128, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-003',   'Abdominal Belt',                     '', 'ortho-belts',           'cat-ortho-belts',          0,    129, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-004',   'Polysling',                          '', 'ortho-belts',           'cat-ortho-belts',          0,    130, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-005',   'Soft & Hard Coolers',                '', 'ortho-belts',           'cat-ortho-belts',          0,    131, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-006',   'Pregnancy Belt',                     '', 'ortho-belts',           'cat-ortho-belts',          0,    132, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-007',   'Shoulder Belt',                      '', 'ortho-belts',           'cat-ortho-belts',          0,    133, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-008',   'Tummy Trimmer Belt',                 '', 'ortho-belts',           'cat-ortho-belts',          0,    134, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-009',   'Snorkling',                          '', 'ortho-belts',           'cat-ortho-belts',          0,    135, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('belt-010',   'Posture Belt',                       '', 'ortho-belts',           'cat-ortho-belts',          0,    136, 'rose',    'In stock', 0, 0, '{}'::text[], ''),

  -- Supports
  ('supp-001',   'Knee Support',                       '', 'supports',              'cat-supports',             0,    137, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('supp-002',   'Knee Gel Support',                   '', 'supports',              'cat-supports',             0,    138, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('supp-003',   'Imported Knee Support',              '', 'supports',              'cat-supports',             0,    139, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('supp-004',   'Ankle Support',                      '', 'supports',              'cat-supports',             0,    140, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('supp-005',   'Wrist Brace',                        '', 'supports',              'cat-supports',             0,    141, 'sky',     'In stock', 0, 0, '{}'::text[], ''),

  -- Breast Pump
  ('bpump-001',  'Life Care Breast Pump',              '', 'breast-pump',           'cat-breast-pump',          0,    142, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('bpump-002',  'Medicare Breast Pump',               '', 'breast-pump',           'cat-breast-pump',          0,    143, 'rose',    'In stock', 0, 0, '{}'::text[], ''),
  ('bpump-003',  'Chaina Breast Pump',                 '', 'breast-pump',           'cat-breast-pump',          0,    144, 'rose',    'In stock', 0, 0, '{}'::text[], ''),

  -- Steamers
  ('steam-001',  'Karliz Steamer',                     '', 'steamers',              'cat-steamers',             0,    145, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('steam-002',  'SC Steamer',                         '', 'steamers',              'cat-steamers',             0,    146, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('steam-003',  'Jaf Steamer',                        '', 'steamers',              'cat-steamers',             0,    147, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('steam-004',  '3 in 1 Steamer',                     '', 'steamers',              'cat-steamers',             0,    148, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('steam-005',  '4 in 1 Steamer',                     '', 'steamers',              'cat-steamers',             0,    149, 'sky',     'In stock', 0, 0, '{}'::text[], ''),
  ('steam-006',  'Life Care Steamer',                  '', 'steamers',              'cat-steamers',             0,    150, 'sky',     'In stock', 0, 0, '{}'::text[], ''),

  -- Suction Machine
  ('suct-001',   'Yuwell',                             '', 'suction-machine',       'cat-suction-machine',      0,    151, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('suct-002',   'Life Care',                          '', 'suction-machine',       'cat-suction-machine',      0,    152, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('suct-003',   'Blevia',                             '', 'suction-machine',       'cat-suction-machine',      0,    153, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('suct-004',   'Easy Care',                          '', 'suction-machine',       'cat-suction-machine',      0,    154, 'slate',   'In stock', 0, 0, '{}'::text[], ''),

  -- Other Items
  ('oth-001',    'Gym Balls',                          '', 'other',                 'cat-other',                0,    155, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-002',    'Hot & Cold Gel',                     '', 'other',                 'cat-other',                0,    156, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-003',    'Hot Water Bottle',                   '', 'other',                 'cat-other',                0,    157, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-004',    'Thermometer Manual Digital',         '', 'other',                 'cat-other',                0,    158, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-005',    'Infrared Thermometer',               '', 'other',                 'cat-other',                0,    159, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-006',    'Adult Diapers',                      '', 'other',                 'cat-other',                0,    160, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-007',    'Gloves',                             '', 'other',                 'cat-other',                0,    161, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-008',    'Norvus Slime',                       '', 'other',                 'cat-other',                0,    162, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-009',    'Drip Set',                           '', 'other',                 'cat-other',                0,    163, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-010',    'Canula',                             '', 'other',                 'cat-other',                0,    164, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-011',    'BP Cuffs',                           '', 'other',                 'cat-other',                0,    165, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-012',    'Bandages',                           '', 'other',                 'cat-other',                0,    166, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-013',    'Torch',                              '', 'other',                 'cat-other',                0,    167, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-014',    'Food Table',                         '', 'other',                 'cat-other',                0,    168, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-015',    'First Aid Box',                      '', 'other',                 'cat-other',                0,    169, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-016',    'Masks',                              '', 'other',                 'cat-other',                0,    170, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-017',    'Insole Ped',                         '', 'other',                 'cat-other',                0,    171, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-018',    'Pulse Oximeter',                     '', 'other',                 'cat-other',                0,    172, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-019',    'Drip Stand',                         '', 'other',                 'cat-other',                0,    173, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-020',    'Urine Bag',                          '', 'other',                 'cat-other',                0,    174, 'slate',   'In stock', 0, 0, '{}'::text[], ''),
  ('oth-021',    'Urine Bottles',                      '', 'other',                 'cat-other',                0,    175, 'slate',   'In stock', 0, 0, '{}'::text[], '');


-- ===== END 20260430120000_categories-and-products-seed.sql =====


-- ===== BEGIN 20260501123000_category-image-url.sql =====

alter table public.categories
add column if not exists image_url text;


-- ===== END 20260501123000_category-image-url.sql =====


-- ===== BEGIN 20260501125500_admin-categories-policies.sql =====

-- Allow admin/staff users to manage categories from authenticated client sessions

DROP POLICY IF EXISTS "Admins can read all categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

CREATE POLICY "Admins can read all categories"
ON public.categories
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete categories"
ON public.categories
FOR DELETE
TO authenticated
USING (public.is_admin());


-- ===== END 20260501125500_admin-categories-policies.sql =====


-- ===== BEGIN 20260502133000_dummy-prices-by-category.sql =====

-- Assign dummy PKR prices to all products.
-- Rules:
-- 1) Prices stay within 1..10,000 PKR
-- 2) Products in the same category share a similar price band
-- 3) Deterministic value per product id (stable across re-runs)

WITH category_ranges(cat, min_price, max_price) AS (
  VALUES
    ('glucometers', 1600, 4200),
    ('bp-digital', 2600, 6800),
    ('bp-manual', 1200, 3200),
    ('weight-scale-digital', 1800, 5200),
    ('weight-scale-manual', 900, 2800),
    ('camote-chairs', 3500, 9800),
    ('walkers', 3200, 7600),
    ('patient-sticks', 700, 1900),
    ('wheelchairs', 7800, 10000),
    ('sugar-strips', 850, 2600),
    ('hearing-aids', 4200, 9800),
    ('heating-pad', 900, 2600),
    ('air-mattress', 3000, 7600),
    ('tens-machine', 3000, 8500),
    ('nebulizer', 2200, 6400),
    ('stethoscope', 1400, 4600),
    ('massagers', 1700, 5200),
    ('ortho-belts', 600, 1900),
    ('supports', 450, 1600),
    ('breast-pump', 3600, 7600),
    ('steamers', 900, 2200),
    ('suction-machine', 5200, 9800),
    ('other', 350, 2800)
),
priced AS (
  SELECT
    p.id,
    COALESCE(r.min_price, 500) AS min_price,
    COALESCE(r.max_price, 3000) AS max_price,
    ((get_byte(decode(md5(p.id), 'hex'), 0) << 8) + get_byte(decode(md5(p.id), 'hex'), 1)) AS seed
  FROM public.products p
  LEFT JOIN category_ranges r ON r.cat = p.cat
)
UPDATE public.products p
SET
  price = LEAST(
    10000,
    GREATEST(
      1,
      priced.min_price + (
        priced.seed % GREATEST(1, priced.max_price - priced.min_price + 1)
      )
    )
  ),
  updated_at = now()
FROM priced
WHERE p.id = priced.id;


-- ===== END 20260502133000_dummy-prices-by-category.sql =====
