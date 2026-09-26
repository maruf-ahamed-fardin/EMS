import { describe, expect, it } from 'vitest';
import { createEmployeeInput, employeeListQuery, updateEmployeeInput, updateMyProfileInput } from '@/lib/validations/employee';

const valid = {
  firstName: ' Tahmina ',
  lastName: 'Sultana',
  dateOfBirth: '1996-03-12',
  departmentId: '0192f0c3-0000-7000-8000-000000000001',
  positionId: '0192f0c3-0000-7000-8000-000000000002',
  joiningDate: '2026-09-21',
  employmentType: 'FULL_TIME',
  workLocation: 'Dhaka office',
  email: 'Tahmina@SeloraX.io',
  phone: '+880 1711-204318',
  address: { line1: 'House 14, Road 7', city: 'Dhaka', country: 'Bangladesh' },
  emergencyContact: { name: 'Shirin Hasan', relationship: 'Sister', phone: '01819552011' },
};

describe('createEmployeeInput', () => {
  it('normalizes text, email and phone, and defaults the account step', () => {
    const data = createEmployeeInput.parse(valid);
    expect(data).toMatchObject({ firstName: 'Tahmina', email: 'tahmina@selorax.io', phone: '+8801711204318', createAccount: false, roleKey: 'employee' });
    expect(data.employeeCode).toBeUndefined();
  });

  it('upper-cases a given employee code and checks its shape', () => {
    expect(createEmployeeInput.parse({ ...valid, employeeCode: 'sx-061' }).employeeCode).toBe('SX-061');
    expect(createEmployeeInput.safeParse({ ...valid, employeeCode: 'SX61' }).success).toBe(false);
  });

  it('rejects impossible dates and ages', () => {
    expect(createEmployeeInput.safeParse({ ...valid, dateOfBirth: '1996-02-30' }).error?.issues[0]?.message).toBe('Enter a real date');
    expect(createEmployeeInput.safeParse({ ...valid, dateOfBirth: '2020-01-01' }).error?.issues[0]?.message).toMatch(/between 16 and 100/);
  });

  it('names the field that is missing', () => {
    const result = createEmployeeInput.safeParse({ ...valid, address: { ...valid.address, city: '' } });
    expect(result.error?.issues[0]).toMatchObject({ path: ['address', 'city'], message: 'Enter the city' });
  });
});

describe('updates', () => {
  it('rejects fields an HR edit does not accept, such as status', () => {
    expect(updateEmployeeInput.safeParse({ status: 'INACTIVE' }).success).toBe(false);
  });

  it('lets people change only their contact details', () => {
    expect(updateMyProfileInput.safeParse({ phone: '+8801711000000' }).success).toBe(true);
    expect(updateMyProfileInput.safeParse({ firstName: 'Someone else' }).success).toBe(false);
    expect(updateMyProfileInput.safeParse({}).success).toBe(false);
  });
});

describe('employeeListQuery', () => {
  it('ignores junk filter values instead of failing the page', () => {
    expect(employeeListQuery.parse({ status: 'WHATEVER', sort: 'drop table', departmentId: '' })).toMatchObject({
      page: 1,
      limit: 20,
      sort: 'name',
      status: undefined,
      departmentId: undefined,
    });
  });

  it('caps the page size', () => {
    expect(employeeListQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});
