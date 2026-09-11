import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../components/layout.jsx', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

const { apiFetch, resetState } = vi.hoisted(() => {
  let state = [];
  const JOBS = [
    { id: 'j1', title: 'Data Scientist', company: 'Acme', location: 'Remote', description: 'Analyze data' },
  ];
  const apiFetch = vi.fn(async (path, opts = {}) => {
    if (path === '/jobs') return JOBS;
    if (path === '/applications') {
      if (opts.method === 'POST') {
        const application = { id: 'a1', jobId: JSON.parse(opts.body).jobId, status: 'applied' };
        state.push(application);
        return application;
      }
      return state;
    }
    throw new Error('unexpected call');
  });
  return { apiFetch, resetState: () => { state = []; } };
});

vi.mock('../../lib/api.js', () => ({ apiFetch }));

import JobsPage from './JobsPage.jsx';

describe('JobsPage', () => {
  beforeEach(() => {
    apiFetch.mockClear();
    resetState();
  });

  it('lists jobs and applies to one', async () => {
    render(
      <MemoryRouter>
        <JobsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Data Scientist')).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'j1' }),
      });
    });
    expect(await screen.findByRole('button', { name: 'Applied' })).toBeDisabled();
  });
});