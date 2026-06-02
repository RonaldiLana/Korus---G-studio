-- PostgreSQL Schema for Korus Immigration Agency System
-- Complete schema with all necessary tables and relationships

CREATE TABLE IF NOT EXISTS agencies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  modules TEXT DEFAULT '{"finance": true, "chat": true, "pipefy": true}',
  logo_url TEXT,
  pre_form_questions TEXT,
  destinations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  agency_id INTEGER,
  phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS visa_types (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS forms (
  id SERIAL PRIMARY KEY,
  visa_type_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  fields TEXT NOT NULL,
  FOREIGN KEY (visa_type_id) REFERENCES visa_types(id)
);

CREATE TABLE IF NOT EXISTS destinations (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  image TEXT,
  highlight_points TEXT,
  flag TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL,
  features TEXT,
  is_recommended BOOLEAN DEFAULT FALSE,
  icon TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS processes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  agency_id INTEGER NOT NULL,
  visa_type_id INTEGER,
  destination_id INTEGER,
  plan_id INTEGER,
  consultant_id INTEGER,
  analyst_id INTEGER,
  status TEXT DEFAULT 'started',
  internal_status TEXT DEFAULT 'pending',
  amount DECIMAL DEFAULT 0,
  is_dependent BOOLEAN DEFAULT FALSE,
  parent_process_id INTEGER,
  travel_date TEXT,
  visa_type_name TEXT,
  plan_name TEXT,
  destination_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (visa_type_id) REFERENCES visa_types(id),
  FOREIGN KEY (destination_id) REFERENCES destinations(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  FOREIGN KEY (consultant_id) REFERENCES users(id),
  FOREIGN KEY (analyst_id) REFERENCES users(id),
  FOREIGN KEY (parent_process_id) REFERENCES processes(id)
);

CREATE TABLE IF NOT EXISTS financials (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  proof_url TEXT,
  confirmed_at TIMESTAMP,
  commission_amount DECIMAL,
  commission_status TEXT,
  type TEXT DEFAULT 'income',
  category TEXT DEFAULT 'Consultoria',
  FOREIGN KEY (process_id) REFERENCES processes(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS revenues (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS form_responses (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL,
  form_id INTEGER,
  data TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded',
  rejection_reason TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (process_id) REFERENCES processes(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_proof BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS process_tasks (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP,
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS form_fields (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  destination_id INTEGER,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  required BOOLEAN DEFAULT FALSE,
  options TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (destination_id) REFERENCES destinations(id)
);

CREATE TABLE IF NOT EXISTS dependents (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  age INTEGER,
  passport TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (process_id) REFERENCES processes(id)
);

CREATE TABLE IF NOT EXISTS client_password_resets (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  agency_id INTEGER NOT NULL,
  reset_by_user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (reset_by_user_id) REFERENCES users(id)
);