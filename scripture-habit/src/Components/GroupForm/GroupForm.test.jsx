import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupForm from './GroupForm';
import { LanguageProvider } from '../../Context/LanguageContext';
import { MemoryRouter } from 'react-router-dom';
import * as fireauth from 'firebase/auth';
import * as firestore from 'firebase/firestore';

// Mock dependencies
// Use vi.hoisted to allow access inside vi.mock and tests
const mocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'user123' } },
    db: {}
}));

vi.mock('../../firebase', () => ({
    auth: mocks.auth,
    db: mocks.db
}));

// Mock child components
vi.mock('../Input/Input', () => ({ default: (props) => <input data-testid={`input-${props.label}`} {...props} /> }));
vi.mock('../Button/Button', () => ({ default: ({ children, ...props }) => <button {...props}>{children}</button> }));
vi.mock('../Input/Checkbox', () => ({ default: (props) => <input type="checkbox" data-testid="checkbox-public" {...props} /> }));

// Mock toast
vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock Firestore
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        collection: vi.fn(),
        addDoc: vi.fn(),
        doc: vi.fn(),
        updateDoc: vi.fn(),
        arrayUnion: vi.fn(),
    };
});

const renderWithProviders = (ui) => {
    return render(
        <MemoryRouter>
            <LanguageProvider>
                {ui}
            </LanguageProvider>
        </MemoryRouter>
    );
};

describe('GroupForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset auth mock default
        mocks.auth.currentUser = { uid: 'user123' };
    });

    it('renders the form correctly', () => {
        renderWithProviders(<GroupForm />);
        // Title check (assuming default en translation)
        expect(screen.getByText('Create a Study Group')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Group/i })).toBeInTheDocument();
        expect(screen.getByTestId('checkbox-public')).toBeInTheDocument();
    });

    it('shows error if not logged in', async () => {
        // Mock no user
        mocks.auth.currentUser = null;

        renderWithProviders(<GroupForm />);

        // Find form and submit directly to ensure handler is called
        // The button text "Create Group" is inside the form
        const submitBtn = screen.getByRole('button', { name: /Create Group/i });
        const form = submitBtn.closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            // Need to match exact translation key output for errorLoggedIn
            // t('groupForm.errorLoggedIn') defaults to "You must be logged in to create a group."
            expect(screen.getByText(/You must be logged in/i)).toBeInTheDocument();
        });
    });

    it('creates a group successfully', async () => {
        mocks.auth.currentUser = { uid: 'user123' };

        const mockAddDoc = firestore.addDoc;
        mockAddDoc.mockResolvedValue({ id: 'newGroupId123' });

        renderWithProviders(<GroupForm />);

        // Fill inputs - use generic textbox role selector
        const inputs = screen.getAllByRole('textbox');
        // inputs[0] should be name, inputs[1] should be description (textarea)

        fireEvent.change(inputs[0], { target: { value: 'My Test Group' } });
        fireEvent.change(inputs[1], { target: { value: 'Test Description' } });

        const submitBtn = screen.getByRole('button', { name: /Create Group/i });
        const form = submitBtn.closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            expect(mockAddDoc).toHaveBeenCalled();
            // Check if toast success was called
            // We mocked toast.success.
        });

        // Verify arguments passed to addDoc
        const callArgs = mockAddDoc.mock.calls[0][1];
        expect(callArgs).toMatchObject({
            name: 'My Test Group',
            description: 'Test Description',
            ownerUserId: 'user123',
            members: ['user123']
        });
    });
});
