CREATE TABLE IF NOT EXISTS configurations (
  site_key UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_key UUID UNIQUE DEFAULT gen_random_uuid(),
  allowed_sets JSONB NOT NULL DEFAULT '["emoji_set_1"]',
  layout_type VARCHAR(50) NOT NULL DEFAULT 'grid',
  max_items INT NOT NULL DEFAULT 10,
  zkp_max_velocity FLOAT NOT NULL DEFAULT 2000.0,
  zkp_min_tremor FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
