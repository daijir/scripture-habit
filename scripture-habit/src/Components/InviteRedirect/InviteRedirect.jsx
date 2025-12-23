import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';

export default function InviteRedirect() {
    const { inviteCode } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (inviteCode) {
            // Normalize to uppercase and store
            localStorage.setItem('pendingInviteCode', inviteCode.trim().toUpperCase());
        }

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                // If logged in, go to dashboard where the join logic will trigger
                navigate('/dashboard', { replace: true });
            } else {
                // If not logged in, go to signup
                navigate('/signup', { replace: true });
            }
        });

        return () => unsubscribe();
    }, [inviteCode, navigate]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--blue-gradient-start)',
            color: 'white',
            fontFamily: 'inherit'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
                <p>Redirecting to your invitation...</p>
            </div>
        </div>
    );
}
