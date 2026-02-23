import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteCard from './NoteCard';
import { LanguageProvider } from '../../Context/LanguageContext';

// Mock dependencies
vi.mock('../../Utils/gospelLibraryMapper', () => ({
    getGospelLibraryUrl: vi.fn((scripture) => {
        if (scripture === 'Book of Mormon') return 'https://fake-url.com';
        return null;
    }),
}));

// Helper to render with providers
const renderWithProviders = (ui) => {
    return render(<LanguageProvider>{ui}</LanguageProvider>);
};

describe('NoteCard', () => {
    const mockNote = {
        id: '1',
        text: 'This is a test note',
        scripture: 'Book of Mormon',
        chapter: '1 Nephi 3:7',
        createdAt: {
            toDate: () => new Date('2023-10-15T12:00:00Z')
        }
    };

    it('renders note content correctly', () => {
        renderWithProviders(<NoteCard note={mockNote} />);

        expect(screen.getByText('This is a test note')).toBeInTheDocument();
        // Date formatting might depend on locale, checking for basic presence
        expect(screen.getByText(/2023/)).toBeInTheDocument();
    });

    it('renders gospel library link when valid', () => {
        renderWithProviders(<NoteCard note={mockNote} />);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'https://fake-url.com');
        expect(link).toHaveTextContent(/Read in Gospel Library/i);
    });

    it('calls onClick when clicked and isEditable is true', () => {
        const handleClick = vi.fn();
        renderWithProviders(<NoteCard note={mockNote} isEditable={true} onClick={handleClick} />);

        // Find the outer card div (note-card class)
        // Since we don't have a specific role, we can get by class or text container
        const card = screen.getByText('This is a test note').closest('.note-card');

        fireEvent.click(card);
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handleClick).toHaveBeenCalledWith(mockNote);
    });

    it('does not call onClick when isEditable is false', () => {
        const handleClick = vi.fn();
        renderWithProviders(<NoteCard note={mockNote} isEditable={false} onClick={handleClick} />);

        const card = screen.getByText('This is a test note').closest('.note-card');

        fireEvent.click(card);
        expect(handleClick).not.toHaveBeenCalled();
    });
});
