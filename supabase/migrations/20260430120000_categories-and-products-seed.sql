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
