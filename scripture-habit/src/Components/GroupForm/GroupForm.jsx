import './GroupForm.css';
import { useState } from "react";

export default function GroupForm() {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    alert(`Group Created: ${groupName}`);
  }

  return (
    <div className="group-page">
      <div className="group-card">
        <h1>Create a Study Group</h1>
        <p className="subtitle">
          Build a scripture study group and invite others to join.
        </p>

        <form onSubmit={handleSubmit} className="group-form">
          <label>Group Name</label>
          <input
            type="text"
            placeholder="Enter group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />

          <label>Description (optional)</label>
          <textarea
            placeholder="Write a short description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <button type="submit" className="create-btn">
            Create Group
          </button>
        </form>
      </div>
    </div>
  );
}
