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
