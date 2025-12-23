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
    });
});
