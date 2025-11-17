
import { useState } from "react";

export default function JoinGroup() {
  const [groupCode, setGroupCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    if (groupCode.trim().length < 4) {
      setError("Invalid group code. Must be at least 4 characters.");
      return;
    }

    setError("");
    alert(`Attempting to join group: ${groupCode}`);
  }

  return (
    <div className="group-page">
      <div className="group-card">
        <h1>Join a Group</h1>
        <p className="subtitle">
          Enter the invite code shared with you to join a scripture study group.
        </p>

        <form onSubmit={handleSubmit} className="group-form">
          <label>Group Code</label>
          <input
            type="text"
            placeholder="Enter group code"
            value={groupCode}
            onChange={(e) => setGroupCode(e.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="create-btn">
            Join Group
          </button>
        </form>
      </div>
    </div>
  );
}
