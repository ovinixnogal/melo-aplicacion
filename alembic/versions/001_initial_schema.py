"""Initial schema baseline

Revision ID: 001
Revises: 
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(table_name):
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # Para PostgreSQL: usar op.add_column directo (NO batch_alter_table)
    # Verificar existencia antes de agregar para no crashear si ya existen

    if table_exists('users'):
        if not column_exists('users', 'is_active'):
            op.add_column('users', sa.Column(
                'is_active', sa.Boolean(), nullable=True, server_default='true'
            ))
        if not column_exists('users', 'is_admin'):
            op.add_column('users', sa.Column(
                'is_admin', sa.Boolean(), nullable=True, server_default='false'
            ))
        if not column_exists('users', 'webauthn_id'):
            op.add_column('users', sa.Column(
                'webauthn_id', sa.String(), nullable=True
            ))

    if table_exists('loan_attachments'):
        if not column_exists('loan_attachments', 'file_size'):
            op.add_column('loan_attachments', sa.Column(
                'file_size', sa.Integer(), nullable=True, server_default='0'
            ))


def downgrade() -> None:
    if table_exists('users'):
        if column_exists('users', 'webauthn_id'):
            op.drop_column('users', 'webauthn_id')
        if column_exists('users', 'is_admin'):
            op.drop_column('users', 'is_admin')
        if column_exists('users', 'is_active'):
            op.drop_column('users', 'is_active')

    if table_exists('loan_attachments'):
        if column_exists('loan_attachments', 'file_size'):
            op.drop_column('loan_attachments', 'file_size')