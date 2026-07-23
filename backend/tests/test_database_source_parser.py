"""Unit tests for strict Database Source Document parsing."""

from __future__ import annotations

import pytest

from apex_pilot.interactive.source import (
    DocumentKind,
    OracleUnitType,
    SourceParseError,
    parse_database_source,
)

COMBINED_PACKAGE = """
-- demo package
CREATE OR REPLACE PACKAGE hr.emp_pkg AS
  PROCEDURE ping;
END emp_pkg;
/

CREATE OR REPLACE PACKAGE BODY hr.emp_pkg AS
  PROCEDURE ping IS BEGIN NULL; END;
END emp_pkg;
/
"""


def test_parse_combined_package() -> None:
    parsed = parse_database_source(COMBINED_PACKAGE)

    assert parsed.kind is DocumentKind.COMBINED_PACKAGE
    assert [unit.identity.unit_type for unit in parsed.units] == [
        OracleUnitType.PACKAGE,
        OracleUnitType.PACKAGE_BODY,
    ]
    assert parsed.units[0].identity.owner == "HR"
    assert parsed.units[0].identity.name == "EMP_PKG"
    assert "/" not in parsed.units[0].ddl_text


def test_parse_rejects_sqlcl_commands() -> None:
    source = """
CREATE OR REPLACE PROCEDURE demo AS BEGIN NULL; END;
/
SET DEFINE OFF
"""
    with pytest.raises(SourceParseError) as error:
        parse_database_source(source)

    assert any("SQLcl command" in item.message for item in error.value.diagnostics)


def test_parse_rejects_extra_sql() -> None:
    source = """
CREATE OR REPLACE FUNCTION demo RETURN NUMBER AS BEGIN RETURN 1; END;
/
SELECT * FROM dual;
"""
    with pytest.raises(SourceParseError) as error:
        parse_database_source(source)

    assert any("Extra SQL" in item.message for item in error.value.diagnostics)


def test_parse_rejects_identity_mismatch() -> None:
    with pytest.raises(SourceParseError) as error:
        parse_database_source(
            COMBINED_PACKAGE,
            expected_owner="HR",
            expected_name="OTHER_PKG",
            expected_unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
        )

    assert "does not match the attached target identity" in str(error.value)
    assert any("Identity mismatch" in item.message for item in error.value.diagnostics)


def test_parse_single_trigger() -> None:
    source = """
CREATE OR REPLACE TRIGGER hr.bi_emp
BEFORE INSERT ON emp
FOR EACH ROW
BEGIN
  NULL;
END;
/
"""
    parsed = parse_database_source(source)
    assert parsed.kind is DocumentKind.SINGLE
    assert parsed.units[0].identity.unit_type is OracleUnitType.TRIGGER
