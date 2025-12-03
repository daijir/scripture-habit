import React from 'react';
import { Link } from 'react-router-dom';
import './GroupOptions.css';

const GroupOptions = () => {
    return (
        <div className="App GroupOptions">
            <div className="AppGlass options-container">
                <h2>Find Your Community</h2>
                <p className="subtitle">Choose how you want to connect with others.</p>

                <div className="options-grid">
                    <Link to="/join-group" className="option-card join-card">
                        <div className="icon">🔍</div>
                        <h3>Join a Group</h3>
                        <p>Find an existing group to study with.</p>
                    </Link>

                    <Link to="/group-form" className="option-card create-card">
                        <div className="icon">✨</div>
                        <h3>Create a Group</h3>
                        <p>Start your own group and invite friends.</p>
                    </Link>
                </div>

                <Link to="/dashboard" className="back-link">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
};

export default GroupOptions;
