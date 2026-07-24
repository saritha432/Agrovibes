-- Create / reset Cropvibe Admin login on your production Postgres (Supabase SQL Editor).
-- Email: info@cropvibe.com
-- Password: Cropvibe@2026

INSERT INTO learn_users (email, password_hash, full_name, role)
VALUES (
  'info@cropvibe.com',
  '$2b$10$KxQGJPWzGLF993.vbs4Cr.G2yPLtOcK3qeVXrVvaDcKPAx7.ssCD6',
  'Cropvibe Admin',
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = 'admin';
