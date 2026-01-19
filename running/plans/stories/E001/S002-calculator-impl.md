# S002: Calculator Implementation

## Metadata
- **Epic**: E001
- **Status**: not_started
- **Dependencies**: [S001]
- **Blocks**: []

## User Story
As a **developer**, I want a **working calculator module**
so that **I can perform arithmetic operations in my code**.

## Acceptance Criteria
1. Given two numbers, calculator.add() returns their sum
2. Given two numbers, calculator.subtract() returns their difference
3. Given two numbers, calculator.multiply() returns their product
4. Given two numbers (divisor != 0), calculator.divide() returns their quotient
5. Given division by zero, calculator raises ValueError with clear message
6. Given negative numbers, all operations work correctly

## Test Scenarios (E2E - 100% coverage required)
```python
def test_add_two_positive_numbers():
    assert calculator.add(2, 3) == 5

def test_add_negative_numbers():
    assert calculator.add(-1, -2) == -3

def test_subtract_returns_difference():
    assert calculator.subtract(5, 3) == 2

def test_multiply_returns_product():
    assert calculator.multiply(4, 5) == 20

def test_divide_returns_quotient():
    assert calculator.divide(10, 2) == 5

def test_divide_by_zero_raises_error():
    with pytest.raises(ValueError):
        calculator.divide(10, 0)
```

## Tasks
- [ ] T002: Implement calculator module | role:implementer | depends:T001
- [ ] T003: Write E2E tests for calculator | role:tester | depends:T002

## Technical Notes
- Follow the design document from T001
- Use type hints
- Handle edge cases gracefully

## Definition of Done
- [ ] calculator.py exists in sandbox/
- [ ] All acceptance criteria have passing tests
- [ ] 100% test coverage
