import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from './LoginForm';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from '../../Context/LanguageContext';
import * as firebaseAuth from 'firebase/auth';

// Mock dependencies
vi.mock('../../firebase', () => ({
    auth: {},
    db: {}
}));

vi.mock('firebase/auth', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        signInWithEmailAndPassword: vi.fn(),
        signInWithPopup: vi.fn(),
        GoogleAuthProvider: vi.fn(),
        GithubAuthProvider: vi.fn(),
        sendEmailVerification: vi.fn(),
        signInWithCredential: vi.fn(),
    };
});

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false),
    }
}));

vi.mock('@codetrix-studio/capacitor-google-auth', () => ({
    GoogleAuth: {
        initialize: vi.fn(),
        signIn: vi.fn(),
    }
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const renderWithProviders = (ui) => {
    return render(
        <LanguageProvider>
            <BrowserRouter>
                {ui}
            </BrowserRouter>
        </LanguageProvider>
    );
};

describe('LoginForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders login form correctly', () => {
        renderWithProviders(<LoginForm />);

        expect(screen.getByRole('heading', { name: /Log In/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
        // Use exact match string to avoid matching "Log in with Google" etc.
        expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
        expect(screen.getByText(/Google/i)).toBeInTheDocument();
        expect(screen.getByText(/GitHub/i)).toBeInTheDocument();
    });

    it('allows user to type email and password', () => {
        renderWithProviders(<LoginForm />);

        const emailInput = screen.getByLabelText(/Email Address/i);
        const passwordInput = screen.getByLabelText(/Password/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(emailInput.value).toBe('test@example.com');
        expect(passwordInput.value).toBe('password123');
    });

    it('navigates to dashboard on successful login', async () => {
        const mockUser = { emailVerified: true };
        const mockUserCredential = { user: mockUser };
        firebaseAuth.signInWithEmailAndPassword.mockResolvedValue(mockUserCredential);

        renderWithProviders(<LoginForm />);

        const emailInput = screen.getByLabelText(/Email Address/i);
        const passwordInput = screen.getByLabelText(/Password/i);
        const submitButton = screen.getByRole('button', { name: 'Log In' });

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('shows error on login failure', async () => {
        const errorMessage = 'Invalid credentials';
        firebaseAuth.signInWithEmailAndPassword.mockRejectedValue(new Error(errorMessage));

        renderWithProviders(<LoginForm />);

        const emailInput = screen.getByLabelText(/Email Address/i);
        const passwordInput = screen.getByLabelText(/Password/i);
        const submitButton = screen.getByRole('button', { name: 'Log In' });

        fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });

    it('shows error if email is not verified', async () => {
        const mockUser = { emailVerified: false };
        const mockUserCredential = { user: mockUser };
        firebaseAuth.signInWithEmailAndPassword.mockResolvedValue(mockUserCredential);

        renderWithProviders(<LoginForm />);

        const emailInput = screen.getByLabelText(/Email Address/i);
        const passwordInput = screen.getByLabelText(/Password/i);
        const submitButton = screen.getByRole('button', { name: 'Log In' });

        fireEvent.change(emailInput, { target: { value: 'unverified@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Please verify your email address/i)).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });
});
