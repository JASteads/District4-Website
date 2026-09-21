import { buildComponents } from "./components.ts";
import { GalleryEditor } from "./gallery-editor.ts";
import { basicAdminAccessRequest } from "./permissions.ts";

import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { GalleryApp } from './React/GalleryApp.tsx'


const toggleUploadMenu = (editor: GalleryEditor) => {
    if (!editor) { return; }
    
    const container = editor.getContainer();

    if (!container) { return; }
    
    container.hidden = !container.hidden;
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await buildComponents();
    const main = document.body.getElementsByTagName('main')[0];

    // Insert the GalleryApp
    createRoot(main).render(createElement(GalleryApp, {
        onReady: async () => {
            const gallerySelect = document.getElementById('gallery-select') as HTMLSelectElement;
            if (gallerySelect) {
                // TODO : Replace this with server HTML injection
                if (await basicAdminAccessRequest(user)) {
                    const uploadText = document.createElement('span');
                    uploadText.className = 'upload-text';
                    uploadText.textContent = 'Upload New Image';

                    gallerySelect.insertAdjacentElement('afterend', uploadText);
                    const editor = new GalleryEditor(user);

                    const editorContainer = await editor.generateEditor(user);
                    if (editorContainer) {
                        const closeButton = document.createElement('button');
                        closeButton.textContent = 'Close';
                        closeButton.addEventListener('click', () => toggleUploadMenu(editor));

                        uploadText.insertAdjacentElement('afterend', editorContainer);
                        editorContainer.appendChild(closeButton);
                    }

                    const container = editor.getContainer();
                    if (container) {
                        container.hidden = true;
                        uploadText.addEventListener('click', () => container.hidden = !container.hidden);
                    }
                }
            }
        }
    }));

    main.hidden = false;
});