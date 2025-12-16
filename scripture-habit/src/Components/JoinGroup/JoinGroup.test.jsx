import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JoinGroup from './JoinGroup';
import { LanguageProvider } from '../../Context/LanguageContext';
import { MemoryRouter } from 'react-router-dom';
import * as firestore from 'firebase/firestore';

// Mock mocks variable accessed via dependency injection
const mocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'user123', getIdToken: vi.fn().mockResolvedValue('token') } },
    db: {}
}));

vi.mock('../../firebase', () => ({
    auth: mocks.auth,
    db: mocks.db
}));

// Mock child components
vi.mock('../Input/Input', () => ({ default: (props) => <input data-testid={`input-${props.id || props.label}`} {...props} /> }));
vi.mock('../Button/Button', () => ({ default: ({ children, ...props }) => <button {...props}>{children}</button> }));
// Mock GroupCard
vi.mock('../../groups/GroupCard', () => ({
    default: ({ group, onJoin }) => (
        <div data-testid="group-card">
            <span>{group.name}</span>
            <button onClick={onJoin}>Join</button>
        </div>
    )
}));

// Mock Firestore
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        getDocs: vi.fn(),
        doc: vi.fn(),
        getDoc: vi.fn(),
        updateDoc: vi.fn(),
        arrayUnion: vi.fn(),
        increment: vi.fn(),
        writeBatch: vi.fn(() => ({
            update: vi.fn(),
            commit: vi.fn(),
        })),
        onSnapshot: vi.fn(() => vi.fn()), // Return an unsubscribe function
    };
});

// Mock firebase/auth
vi.mock('firebase/auth', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        onAuthStateChanged: vi.fn((auth, callback) => {
            // Immediately execute with current mocked user
            // mocks is defined via vi.hoisted above so we can use it, but safe check in case
            callback(mocks.auth.currentUser);
            return vi.fn(); // return unsubscribe function
        }),
    };
});

// Mock fetch for public groups URL
global.fetch = vi.fn();

// Mock window.alert
window.alert = vi.fn();

const renderWithProviders = (ui) => {
    return render(
        <MemoryRouter>
            <LanguageProvider>
                {ui}
            </LanguageProvider>
        </MemoryRouter>
    );
};

describe('JoinGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'user123', getIdToken: vi.fn().mockResolvedValue('token') };
        // Reset fetch mock default
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ([]) // default empty array
        });
    });

    it('renders and fetches public groups', async () => {
        // Mock fetch response for public groups
        const publicGroups = [
            { id: 'g1', name: 'Public Group 1', isPublic: true },
            { id: 'g2', name: 'Public Group 2', isPublic: true }
        ];
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => publicGroups
        });

        renderWithProviders(<JoinGroup />);

        // Wait for fetch to complete and groups to appear
        await waitFor(() => {
            expect(screen.getByText('Public Group 1')).toBeInTheDocument();
            expect(screen.getByText('Public Group 2')).toBeInTheDocument();
        });

        // Check text
        expect(screen.getByText(/Have an Invite Code?/i)).toBeInTheDocument();
        // t('joinGroup.inviteCodeTitle') -> "Have an Invite Code?" in English
    });

    it('joins a group via invite code', async () => {
        // Mock getDocs to find a group by code
        const mockGetDocs = firestore.getDocs;
        mockGetDocs.mockResolvedValue({
            empty: false,
            docs: [{
                id: 'inviteGroupId',
                data: () => ({ name: 'Invite Group', members: [], membersCount: 0 })
            }],
            // Add forEach for consistency if code iterates (though it takes docs[0])
            forEach: vi.fn()
        });

        // Mock fetch more robustly to handle both public groups load and join action
        global.fetch.mockImplementation((url) => {
            if (url === '/api/groups') {
                return Promise.resolve({
                    ok: true,
                    json: async () => ([]) // Return empty array for groups so map works
                });
            }
            if (url === '/api/join-group') {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({})
                });
            }
            return Promise.resolve({ ok: false });
        });

        renderWithProviders(<JoinGroup />);

        // ID for invite code input is "inviteCode" in source
        const codeInput = screen.getByTestId('input-inviteCode');
        fireEvent.change(codeInput, { target: { value: 'CODE123' } });

        const submitBtn = screen.getByRole('button', { name: /Join Group/i });
        const form = submitBtn.closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            // Check if alert was called or fetch/join logic
            // JoinGroup.jsx calls alert on success
            expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/Successfully joined group/));
        });
    });

    it('shows error for invalid invite code', async () => {
        const mockGetDocs = firestore.getDocs;
        mockGetDocs.mockResolvedValue({
            empty: true, // No group found
            docs: [],
            forEach: vi.fn()
        });

        // Ensure /api/groups doesn't fail
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ([])
        });

        renderWithProviders(<JoinGroup />);

        const codeInput = screen.getByTestId('input-inviteCode');
        fireEvent.change(codeInput, { target: { value: 'INVALID' } });

        const submitBtn = screen.getByRole('button', { name: /Join Group/i });
        const form = submitBtn.closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText(/Invalid invite code/i)).toBeInTheDocument();
        });
    });
});
