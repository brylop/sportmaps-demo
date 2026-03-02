-- Add temporary fields to children table to store parent contact info for pre-registration
ALTER TABLE children
ADD COLUMN parent_email_temp TEXT,
ADD COLUMN parent_phone_temp TEXT;

-- Index for faster lookup when parent registers
CREATE INDEX idx_children_parent_email_temp ON children(parent_email_temp);

COMMENT ON COLUMN children.parent_email_temp IS 'Email del padre para pre-registro antes de que cree su cuenta';
