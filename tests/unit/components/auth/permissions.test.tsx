import { render, screen } from '@testing-library/react';
import { Can, PermissionsProvider } from '@/components/auth/permissions';

function renderWith(permissions: Parameters<typeof PermissionsProvider>[0]['permissions'], ui: React.ReactNode) {
  return render(<PermissionsProvider permissions={permissions}>{ui}</PermissionsProvider>);
}

describe('Can', () => {
  it('renders children when the permission is granted', () => {
    renderWith({ 'employee.create': 'ALL' }, <Can permission="employee.create">Add employee</Can>);
    expect(screen.getByText('Add employee')).toBeInTheDocument();
  });

  it('renders the fallback when the scope is too narrow', () => {
    renderWith(
      { 'employee.view': 'OWN' },
      <Can permission="employee.view" atLeast="TEAM" fallback="No team view">
        Team list
      </Can>,
    );
    expect(screen.queryByText('Team list')).not.toBeInTheDocument();
    expect(screen.getByText('No team view')).toBeInTheDocument();
  });

  it('renders nothing without a provider', () => {
    const { container } = render(<Can permission="audit.view">Audit</Can>);
    expect(container).toBeEmptyDOMElement();
  });
});
