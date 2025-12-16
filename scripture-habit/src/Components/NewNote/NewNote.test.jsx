import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewNote from './NewNote';
import { LanguageProvider } from '../../Context/LanguageContext';
import * as firestore from 'firebase/firestore';

// Mock dependnecies
vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock Firestore functions
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        collection: vi.fn(),
        addDoc: vi.fn(),
        serverTimestamp: vi.fn(() => 'mock-timestamp'),
        updateDoc: vi.fn(),
        doc: vi.fn(),
        getDoc: vi.fn(),
        increment: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        getDocs: vi.fn(),
        Timestamp: {
            now: vi.fn(() => ({ toMillis: () => 1000 })),
            fromMillis: vi.fn(),
        },
        arrayUnion: vi.fn(),
    };
});

// Mock external libraries
vi.mock('axios', () => ({
    default: {
        post: vi.fn()
    }
}));

vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn()
    }
}));

// Mock Data
vi.mock('../../Data/Data', () => ({
    ScripturesOptions: [
        { value: 'Book of Mormon', label: 'Book of Mormon' },
        { value: 'New Testament', label: 'New Testament' }
    ]
}));

vi.mock('../../Data/MasteryScriptures', () => ({
    MasteryScriptures: [
        { scripture: 'Book of Mormon', chapter: '1 Nephi 3:7' }
    ]
}));

vi.mock('../../Data/DailyReadingPlan', () => ({
    getTodayReadingPlan: vi.fn(() => ({ scripts: ['1 Nephi 1'] }))
}));

const mockUserData = {
    uid: 'test-user-id',
    nickname: 'Test User',
    groupId: 'test-group-id',
};

// Wrapper for Language Context
const renderWithProviders = (ui) => {
    return render(
        <LanguageProvider>
            {ui}
        </LanguageProvider>
    );
};

describe('NewNote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly when open', () => {
        renderWithProviders(
            <NewNote isOpen={true} onClose={() => { }} userData={mockUserData} />
        );
        expect(screen.getByText(/New Note/i)).toBeInTheDocument();
        expect(screen.getByText(/Choose the category/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        renderWithProviders(
            <NewNote isOpen={false} onClose={() => { }} userData={mockUserData} />
        );
        expect(screen.queryByText(/New Study Note/i)).not.toBeInTheDocument();
    });

    it('allows inputting scripture, chapter, and comment', () => {
        renderWithProviders(
            <NewNote isOpen={true} onClose={() => { }} userData={mockUserData} />
        );

        // Select scripture (Using react-select is tricky in tests, usually need byRole or label)
        // Here we can simulate selecting by finding the input inside Select or simply asserting key elements exist.
        // For simplicity, let's just checking inputs we can easily target.

        // Note: interacting with react-select via testing-library can be complex.
        // We might simply test if standard inputs are there.
        const chapterInput = screen.getByLabelText(/Chapter/i);
        const commentInput = screen.getByLabelText(/Comment/i);

        fireEvent.change(chapterInput, { target: { value: '1 Nephi 1' } });
        fireEvent.change(commentInput, { target: { value: 'My thoughts' } });

        expect(chapterInput.value).toBe('1 Nephi 1');
        expect(commentInput.value).toBe('My thoughts');
    });

    it('handles surprise me button', () => {
        renderWithProviders(
            <NewNote isOpen={true} onClose={() => { }} userData={mockUserData} />
        );

        const surpriseBtn = screen.getByText(/Surprise Me/i);
        fireEvent.click(surpriseBtn);

        // Should fill inputs based on mocked MasteryScriptures
        expect(screen.getByLabelText(/Chapter/i).value).toBe('1 Nephi 3:7');
    });

    it('submits a new note successfully', async () => {
        // Mock getDoc for user data check
        const mockUserSnap = {
            exists: () => true,
            data: () => ({ streakCount: 5, lastPostDate: null })
        };
        firestore.getDoc.mockResolvedValue(mockUserSnap);
        firestore.addDoc.mockResolvedValue({ id: 'new-note-id' });

        const onCloseMock = vi.fn();

        renderWithProviders(
            <NewNote isOpen={true} onClose={onCloseMock} userData={mockUserData} />
        );

        // Simulate filling form - dealing with react-select is hard without deeper mocking or userEvent
        // For this integration test level, we can mock the internal state setting or
        // just try to fill the "Chapter" and "Comments" which are standard inputs,
        // but "Scripture" is required for submit.
        // Let's rely on "Surprise Me" to fill valid data quickly!
        const surpriseBtn = screen.getByText(/Surprise Me/i);
        fireEvent.click(surpriseBtn);

        const commentInput = screen.getByLabelText(/Comment/i);
        fireEvent.change(commentInput, { target: { value: 'Great note' } });

        const submitBtn = screen.getByText(/Post/i);
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(firestore.addDoc).toHaveBeenCalled();
            expect(onCloseMock).toHaveBeenCalled();
        });
    });
});
