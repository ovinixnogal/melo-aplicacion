"""Initial schema baseline

Revision ID: 001
Revises: 
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Esta migración es un baseline: el schema ya existe.
    # Solo asegura que las columnas agregadas manualmente estén presentes.
    
    # Usar batch_alter_table para compatibilidad SQLite
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'))
        batch_op.add_column(sa.Column('is_admin', sa.Boolean(), nullable=True, server_default='false'))
        batch_op.add_column(sa.Column('webauthn_id', sa.String(), nullable=True))
    
    with op.batch_alter_table('loan_attachments') as batch_op:
        batch_op.add_column(sa.Column('file_size', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('webauthn_id')
        batch_op.drop_column('is_admin')
        batch_op.drop_column('is_active')
    
    with op.batch_alter_table('loan_attachments') as batch_op:
        batch_op.drop_column('file_size')
