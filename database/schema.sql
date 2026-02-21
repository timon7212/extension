-- ============================================
-- Outreach Management System — Database Schema
-- PostgreSQL
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- EMPLOYEES
-- =====================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- LEADS
-- =====================
CREATE TYPE lead_stage AS ENUM (
    'New',
    'Invited',
    'Connected',
    'Messaged',
    'Replied',
    'Meeting'
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    linkedin_url VARCHAR(500) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    company VARCHAR(255),
    location VARCHAR(255),
    campaign_tag VARCHAR(255),
    stage lead_stage NOT NULL DEFAULT 'New',
    owner_employee_id UUID NOT NULL REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_owner ON leads(owner_employee_id);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_campaign ON leads(campaign_tag);

-- =====================
-- EVENTS
-- =====================
CREATE TYPE event_type AS ENUM (
    'invite_sent',
    'connected',
    'message_sent',
    'reply_received',
    'meeting_booked'
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    type event_type NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_lead ON events(lead_id);
CREATE INDEX idx_events_employee ON events(employee_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at);

-- =====================
-- TASKS
-- =====================
CREATE TYPE task_status AS ENUM ('open', 'done');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    type VARCHAR(255) NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    status task_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_employee ON tasks(employee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_at);

-- =====================
-- SEED: Admin user (password: admin123)
-- Hash generated with bcrypt, 10 rounds
-- =====================
-- INSERT INTO employees (email, password_hash, name, role)
-- VALUES ('admin@outreach.local', '<bcrypt_hash>', 'Admin', 'admin');
