import React from 'react';
import './NewEntry.css';
import { ScripturesOptions } from '../../Data/Data';
import Select from 'react-select';
import Checkbox from '../Input/Checkbox';
import Input from '../Input/Input';

/*
  NOTE FOR BACKEND DEV:

  - 'image' state holds the selected file object.
  - 'newEntry', 'comment', 'scripture', 'isPublic' are all ready to be sent.
  - When submitting the form, you can handle sending these values to the server.
  - Consider adding validation and storage logic (e.g., Firebase Storage, API endpoint).

  Example usage:
    const formData = new FormData();
    formData.append('image', image);
    formData.append('title', newEntry);
    ...
*/

const NewEntry = ({isOpen, onClose}) => {
    //Form fields
    const [newEntry,setNewEntry] = React.useState('');
    const [scripture,setScripture] = React.useState('');
    const [selectedOption,setSelectedOption] = React.useState(null);
    const [comment,setComment] = React.useState('');
    const [isPublic,setIsPublic] = React.useState('');


    // Image upload
    const [image,setImage] = React.useState(null);
    const [imagePreview, setImagePreview] = React.useState(null);

    if (!isOpen) return null;

  return (
    <div className="ModalOverlay" onClick={onClose}>
        <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
            <h1>New Entry</h1>

            {/* Title input */}
            <Input
                label="Title"
                type="text"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                required
            />

            {/* Scripture selection (react-select) */}
            <div>            
                <label htmlFor="scripture-select">Choose the scripture</label>
                <Select
                    options={ScripturesOptions}
                    onChange={(option) => {
                        setSelectedOption(option);
                        setScripture(option?.value);
                    }}
                    value={selectedOption}
                    placeholder="Please choose a scripture option"
                    styles={{
                        control: (base) => ({
                        ...base,
                        backgroundColor: 'rgba(255, 255, 255, 0.35)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        borderRadius: '0.5rem',
                        padding: '0.2rem 0.4rem',
                        boxShadow: 'none',
                        '&:hover': {
                            borderColor: 'rgba(255, 255, 255, 0.4)',
                        },
                        }),
                        menu: (base) => ({
                        ...base,
                        backgroundColor: 'rgba(254, 172, 94)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '0.5rem',
                        }),
                        singleValue: (base) => ({
                        ...base,
                        color: '#000',
                        }),
                        placeholder: (base) => ({
                        ...base,
                        color: 'rgba(0,0,0,0.6)',
                        }),
                        option: (base, state) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        backgroundColor: state.isFocused
                            ? 'rgba(255,255,255,0.65)'
                            : 'transparent',
                        color: '#000',
                        '&:active': {
                            backgroundColor: 'rgba(255,255,255,0.55)',
                        },
                        }),}}
                />
            </div>

            {/* Comment textarea */}
            <Input 
                label="Comment"
                as="textarea" //Custom Input componet supports textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
            />

            {/* Visibility option */}
            <Checkbox
                label="Share with my group"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
            />

            {/* Image upload input */}
            <div className="ImageUpload">
                <label htmlFor="">Upload an image(optional)</label>

                <input 
                    type="file" 
                    accept='image/*'
                    onChange={(e) => {
                        const file = e.target.files[0];

                        //Store the raw file (for sending to backend)
                        setImage(file);

                        //Generate a preview URL for UX
                        setImagePreview(URL.createObjectURL(file));

                        // TODO: Backend integration
                        // When backend is ready, send 'file' to server or Firebase here.
                        // Example: await uploadImage(file)
                    }}
                />

                {/* Live preview of the selected image */}
                {imagePreview && (
                    <img
                        src={imagePreview}
                        alt="Preview"
                        className="image-preview"
                    />
                )}
            </div>
        </div>
    </div>
  );
};

export default NewEntry;