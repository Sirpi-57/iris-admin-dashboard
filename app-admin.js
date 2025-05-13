// app-admin.js
import { db, storage, auth, serverTimestamp } from './firebase-config.js'; // CORRECTED Import

// --- DOM Elements ---
const jobForm = document.getElementById('jobForm');
const jobListingsContainerAdmin = document.getElementById('jobListingsContainerAdmin');
const addJobBtn = document.getElementById('addJobBtn');
const jobModalElement = document.getElementById('jobModal');
const jobModal = jobModalElement ? new bootstrap.Modal(jobModalElement) : null;
const jobIdField = document.getElementById('jobId');
const saveJobBtn = document.getElementById('saveJobBtn');

// Logo upload elements
const companyLogoInput = document.getElementById('companyLogo');
const logoPreview = document.getElementById('logoPreview');
const companyLogoUrlField = document.getElementById('companyLogoUrl');
let currentLogoFile = null;

// Custom Fields elements
const customFieldsContainer = document.getElementById('customFieldsContainer');
const addCustomFieldBtn = document.getElementById('addCustomFieldBtn');

// --- Logo Preview Logic ---
if (companyLogoInput) {
    companyLogoInput.addEventListener('change', (e) => {
        currentLogoFile = e.target.files[0];
        if (currentLogoFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                logoPreview.src = event.target.result;
                logoPreview.style.display = 'block';
            }
            reader.readAsDataURL(currentLogoFile);
            companyLogoUrlField.value = '';
        } else {
            logoPreview.style.display = 'none';
            logoPreview.src = '#';
        }
    });
} else {
    console.error("Company Logo input element not found.");
}


// --- Custom Fields Logic ---
if (addCustomFieldBtn) {
    addCustomFieldBtn.addEventListener('click', () => {
        const fieldId = `customField_${Date.now()}`;
        const customFieldHTML = `
            <div class="row mb-2 custom-field-row" id="${fieldId}">
                <div class="col-5">
                    <input type="text" class="form-control form-control-sm custom-field-key" placeholder="Field Name (e.g., Team Size)">
                </div>
                <div class="col-5">
                    <input type="text" class="form-control form-control-sm custom-field-value" placeholder="Field Value (e.g., 5-10 people)">
                </div>
                <div class="col-2">
                    <button type="button" class="btn btn-danger btn-sm remove-custom-field-btn" data-remove="${fieldId}" title="Remove Field">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        if (customFieldsContainer) {
           customFieldsContainer.insertAdjacentHTML('beforeend', customFieldHTML);
        }
    });
}

if (customFieldsContainer) {
    customFieldsContainer.addEventListener('click', (e) => {
        const removeButton = e.target.closest('.remove-custom-field-btn');
        if (removeButton) {
            const fieldToRemoveId = removeButton.dataset.remove;
            document.getElementById(fieldToRemoveId)?.remove();
        }
    });
}

/**
 * Collects data from all custom field inputs into an object.
 * @returns {object} Key-value pairs of custom fields.
 */
function getCustomFieldsData() {
    const customFields = {};
    if (customFieldsContainer) {
        customFieldsContainer.querySelectorAll('.custom-field-row').forEach(row => {
            const keyInput = row.querySelector('.custom-field-key');
            const valueInput = row.querySelector('.custom-field-value');
            const key = keyInput ? keyInput.value.trim() : '';
            const value = valueInput ? valueInput.value.trim() : '';
            if (key) {
                customFields[key] = value;
            }
        });
    }
    return customFields;
}

/**
 * Populates the custom fields section in the modal when editing.
 * @param {object} fields Key-value pairs of custom fields.
 */
function populateCustomFields(fields) {
    if (!customFieldsContainer) return;
    customFieldsContainer.innerHTML = '';
    if (fields && typeof fields === 'object') {
        for (const key in fields) {
            const safeKey = key.replace(/[^a-zA-Z0-9]/g, '');
            const fieldId = `customField_${Date.now()}_${safeKey}`;
            const customFieldHTML = `
                <div class="row mb-2 custom-field-row" id="${fieldId}">
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm custom-field-key" value="${key}" placeholder="Field Name">
                    </div>
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm custom-field-value" value="${fields[key]}" placeholder="Field Value">
                    </div>
                    <div class="col-2">
                         <button type="button" class="btn btn-danger btn-sm remove-custom-field-btn" data-remove="${fieldId}" title="Remove Field">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
            customFieldsContainer.insertAdjacentHTML('beforeend', customFieldHTML);
        }
    }
}


// --- Job Form Submission (Add/Edit) ---
if (jobForm) {
    jobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert("Admin not logged in! Please refresh and log in.");
            return;
        }
        
        try {
            const token = await currentUser.getIdTokenResult(true);
            if (!token.claims.isAdmin) {
                alert("Authorization Error! You no longer have permission.");
                auth.signOut();
                return;
            }
        } catch(claimError) {
            console.error("Error fetching claims during save:", claimError);
            alert("Could not verify admin status. Please try again.");
            return;
        }

        if (saveJobBtn) {
            saveJobBtn.disabled = true;
            saveJobBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }

        const id = jobIdField.value;

        // Timestamp helper function
        const toTimestamp = (dateStr) => {
            if (!dateStr) return null;
            try {
                const date = new Date(dateStr + 'T00:00:00');
                return window.firebase.firestore.Timestamp.fromDate(date);
            } catch (e) {
                console.error("Invalid date format:", dateStr, e);
                return null;
            }
        };
        
        // Handle the category and subcategory fields
        let finalCategory = jobForm.category.value;
        let finalSubCategory = jobForm.subCategory.value;
        
        // If "Other" is selected, use the custom input values
        if (finalCategory === 'Other' && document.getElementById('customCategory').value) {
            finalCategory = document.getElementById('customCategory').value.trim();
        }
        
        if (finalSubCategory === 'Other' && document.getElementById('customSubCategory').value) {
            finalSubCategory = document.getElementById('customSubCategory').value.trim();
        }

        // Handle logo upload
        let logoUrl = companyLogoUrlField.value;
        if (currentLogoFile) {
            console.log("Uploading new logo...");
            try {
                const logoRef = storage.ref(`company_logos/${Date.now()}_${currentLogoFile.name}`);
                const snapshot = await logoRef.put(currentLogoFile);
                logoUrl = await snapshot.ref.getDownloadURL();
                console.log("Logo uploaded successfully:", logoUrl);
            } catch (error) {
                console.error("Error uploading logo:", error);
                alert("Error uploading logo: " + error.message);
                if (saveJobBtn) {
                    saveJobBtn.disabled = false;
                    saveJobBtn.textContent = 'Save Job';
                }
                return;
            }
        }
        
        // Parse tech stacks
        let techStacksArray = [];
        try {
            const techStacksValue = document.getElementById('techStacks').value;
            techStacksArray = JSON.parse(techStacksValue);
        } catch (e) {
            // Fallback to original method
            techStacksArray = jobForm.techStacks.value.split(',').map(s => s.trim()).filter(s => s);
        }

        // Complete job data object
        const jobData = {
            title: jobForm.title.value.trim(),
            companyName: jobForm.companyName.value.trim(),
            companyLogoUrl: logoUrl || null,
            location: jobForm.location.value.trim(),
            category: finalCategory,
            subCategory: finalSubCategory,
            description: jobForm.description.value.trim(),
            requirements: jobForm.requirements.value.trim(),
            experienceLevel: jobForm.experienceLevel.value.trim(),
            techStacks: techStacksArray,
            previousInterviewQuestions: jobForm.previousInterviewQuestions.value
                .replace(/\r\n/g, '\n')
                .split(/[,\n]/)
                .map(s => s.trim())
                .filter(s => s),
            sourceLink: jobForm.sourceLink.value.trim(),
            salaryRange: jobForm.salaryRange.value.trim(),
            postedDate: toTimestamp(jobForm.postedDate.value),
            expiryDate: toTimestamp(jobForm.expiryDate.value),
            relocation: jobForm.relocation.checked,
            status: jobForm.status.value,
            customFields: getCustomFieldsData(),
            uploadedBy: currentUser.uid,
            updatedAt: serverTimestamp()
        };

        try {
            let operation;
            if (id) {
                console.log(`Updating job ID: ${id}`);
                operation = db.collection('jobPostings').doc(id).update(jobData);
            } else {
                console.log("Adding new job");
                jobData.createdAt = serverTimestamp();
                operation = db.collection('jobPostings').add(jobData);
            }

            await operation;
            alert(`Job ${id ? 'updated' : 'added'} successfully!`);

            jobForm.reset();
            jobIdField.value = '';
            logoPreview.style.display = 'none';
            logoPreview.src = '#';
            companyLogoUrlField.value = '';
            currentLogoFile = null;
            customFieldsContainer.innerHTML = '';
            if (jobModal) jobModal.hide();
            loadJobsForAdmin();

        } catch (error) {
            console.error("Error saving job to Firestore:", error);
            alert("Error saving job: " + error.message);
        } finally {
            if (saveJobBtn) {
                saveJobBtn.disabled = false;
                saveJobBtn.textContent = 'Save Job';
            }
        }
    });
}

// Complete Tech Stack Management Implementation
function initTechStackManager() {
    const techStackInput = document.getElementById('techStackInput');
    const techStackChips = document.getElementById('techStackChips');
    const techStacksHidden = document.getElementById('techStacks');
    const techStackSuggestions = document.getElementById('techStackSuggestions');
    
    // Current tech stacks array
    let techStacks = [];
    
    // Function to update tech stacks hidden input and UI
    function updateTechStacks() {
        if (techStacksHidden) {
            techStacksHidden.value = JSON.stringify(techStacks);
        }
        
        if (techStackChips) {
            techStackChips.innerHTML = '';
            techStacks.forEach(tech => {
                const chip = document.createElement('div');
                chip.className = 'tech-chip';
                chip.innerHTML = `
                    <span>${tech}</span>
                    <button type="button" class="tech-chip-remove" data-tech="${tech}">&times;</button>
                `;
                techStackChips.appendChild(chip);
            });
        }
    }
    
    // Add a tech stack
    function addTechStack(tech) {
        tech = tech.trim();
        if (tech && !techStacks.includes(tech)) {
            techStacks.push(tech);
            updateTechStacks();
            
            // Focus back on input for quick additions
            if (techStackInput) {
                techStackInput.value = '';
                techStackInput.focus();
            }
        }
    }
    
    // Remove a tech stack
    function removeTechStack(tech) {
        techStacks = techStacks.filter(t => t !== tech);
        updateTechStacks();
    }
    
    // Handle tech stack input
    if (techStackInput) {
        // Remove any existing listeners
        const newTechStackInput = techStackInput.cloneNode(true);
        if (techStackInput.parentNode) {
            techStackInput.parentNode.replaceChild(newTechStackInput, techStackInput);
        }
        
        newTechStackInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = this.value.trim();
                if (value) {
                    // Allow multiple tags separated by commas
                    if (value.includes(',')) {
                        const tags = value.split(',');
                        tags.forEach(tag => {
                            if (tag.trim()) {
                                addTechStack(tag);
                            }
                        });
                    } else {
                        addTechStack(value);
                    }
                }
            }
        });
    }
    
    // Handle clicks on tech stack chips to remove
    if (techStackChips) {
        // Remove any existing listeners
        const newTechStackChips = techStackChips.cloneNode(true);
        if (techStackChips.parentNode) {
            techStackChips.parentNode.replaceChild(newTechStackChips, techStackChips);
        }
        
        newTechStackChips.addEventListener('click', function(e) {
            if (e.target.classList.contains('tech-chip-remove')) {
                const tech = e.target.getAttribute('data-tech');
                if (tech) {
                    removeTechStack(tech);
                }
            }
        });
    }
    
    // Handle clicks on tech stack suggestions
    if (techStackSuggestions) {
        // Remove any existing listeners
        const newTechStackSuggestions = techStackSuggestions.cloneNode(true);
        if (techStackSuggestions.parentNode) {
            techStackSuggestions.parentNode.replaceChild(newTechStackSuggestions, techStackSuggestions);
        }
        
        newTechStackSuggestions.addEventListener('click', function(e) {
            if (e.target.classList.contains('tech-suggestion')) {
                const tech = e.target.textContent;
                addTechStack(tech);
            }
        });
    }
    
    // Initialize from existing data when editing
    if (jobForm && jobIdField && jobIdField.value) {
        // Get existing tech stacks from the form
        const existingInput = jobForm.techStacks;
        if (existingInput && existingInput.value) {
            try {
                // Try parsing as JSON first
                let techArray = [];
                try {
                    techArray = JSON.parse(existingInput.value);
                } catch (e) {
                    // If not valid JSON, handle as comma-separated string
                    techArray = existingInput.value.split(',').map(s => s.trim()).filter(Boolean);
                }
                
                techStacks = techArray;
                updateTechStacks();
            } catch (e) {
                console.error('Error initializing tech stacks:', e);
            }
        }
    }
    
    // Return functions for external use if needed
    return {
        addTechStack,
        removeTechStack,
        getTechStacks: () => [...techStacks],
        setTechStacks: (newTechStacks) => {
            if (Array.isArray(newTechStacks)) {
                techStacks = [...newTechStacks];
                updateTechStacks();
            }
        }
    };
}

// Complete Category and SubCategory Management Implementation
function initCategoryManager() {
    const categorySelect = document.getElementById('category');
    const subCategorySelect = document.getElementById('subCategory');
    const customCategoryInput = document.getElementById('customCategory');
    const customSubCategoryInput = document.getElementById('customSubCategory');
    
    // Common categories and subcategories
    const categorySubcategoryMap = {
        'Technology': [
            'Frontend Development',
            'Backend Development',
            'Full Stack Development',
            'Mobile Development',
            'DevOps',
            'Data Science',
            'Machine Learning',
            'QA Testing',
            'UI/UX Design',
            'Cybersecurity'
        ],
        'Finance': [
            'Accounting',
            'Investment Banking',
            'Financial Analysis',
            'Wealth Management',
            'Risk Management',
            'Tax Planning',
            'Corporate Finance',
            'Financial Planning'
        ],
        'Healthcare': [
            'Nursing',
            'Medical Doctor',
            'Healthcare Administration',
            'Physical Therapy',
            'Mental Health',
            'Dentistry',
            'Pharmacy',
            'Medical Research'
        ],
        'Education': [
            'Teaching',
            'Administration',
            'Curriculum Development',
            'Educational Technology',
            'Special Education',
            'Higher Education',
            'Early Childhood Education',
            'Corporate Training'
        ],
        'Marketing': [
            'Digital Marketing',
            'Content Marketing',
            'SEO/SEM',
            'Social Media Marketing',
            'Market Research',
            'Brand Management',
            'Public Relations',
            'Email Marketing'
        ],
        'Sales': [
            'Business Development',
            'Account Management',
            'Inside Sales',
            'Outside Sales',
            'Sales Operations',
            'Sales Management',
            'Retail Sales',
            'Technical Sales'
        ],
        'Design': [
            'Graphic Design',
            'UX/UI Design',
            'Product Design',
            'Web Design',
            'Industrial Design',
            'Fashion Design',
            'Interior Design',
            'Brand Design'
        ],
        'Operations': [
            'Project Management',
            'Supply Chain',
            'Logistics',
            'Facilities Management',
            'Quality Assurance',
            'Process Improvement',
            'Business Operations',
            'Office Management'
        ]
    };
    
    // Initialize category dropdown
    function initializeCategories() {
        if (!categorySelect) return;
        
        // Clear and add default option
        categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
        
        // Add standard categories
        Object.keys(categorySubcategoryMap).sort().forEach(category => {
            categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
        });
        
        // Add "Other" option
        categorySelect.innerHTML += '<option value="Other">Other (specify)</option>';
    }
    
    // Update subcategory options based on selected category
    function updateSubcategories(selectedCategory) {
        if (!subCategorySelect) return;
        
        // Clear and add default option
        subCategorySelect.innerHTML = '<option value="" disabled selected>Select a sub-category</option>';
        
        // If no category selected, just leave the default option
        if (!selectedCategory || selectedCategory === 'Other') {
            subCategorySelect.innerHTML += '<option value="Other">Other (specify)</option>';
            return;
        }
        
        // Add subcategories for the selected category
        const subcategories = categorySubcategoryMap[selectedCategory] || [];
        subcategories.sort().forEach(subcategory => {
            subCategorySelect.innerHTML += `<option value="${subcategory}">${subcategory}</option>`;
        });
        
        // Add "Other" option
        subCategorySelect.innerHTML += '<option value="Other">Other (specify)</option>';
    }
    
    // Show/hide custom category input based on selection
    function toggleCustomCategoryInput() {
        if (!customCategoryInput) return;
        
        const selectedValue = categorySelect.value;
        if (selectedValue === 'Other') {
            customCategoryInput.style.display = 'block';
            customCategoryInput.required = true;
        } else {
            customCategoryInput.style.display = 'none';
            customCategoryInput.required = false;
            customCategoryInput.value = ''; // Clear the value when hidden
        }
    }
    
    // Show/hide custom subcategory input based on selection
    function toggleCustomSubcategoryInput() {
        if (!customSubCategoryInput) return;
        
        const selectedValue = subCategorySelect.value;
        if (selectedValue === 'Other') {
            customSubCategoryInput.style.display = 'block';
            customSubCategoryInput.required = true;
        } else {
            customSubCategoryInput.style.display = 'none';
            customSubCategoryInput.required = false;
            customSubCategoryInput.value = ''; // Clear the value when hidden
        }
    }
    
    // Add event listeners
    function setupEventListeners() {
        if (categorySelect) {
            // Remove existing listeners by cloning and replacing
            const newCategorySelect = categorySelect.cloneNode(true);
            if (categorySelect.parentNode) {
                categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);
            }
            
            // Update reference to the new element
            categorySelect = newCategorySelect;
            
            // Add event listener to category select
            categorySelect.addEventListener('change', function() {
                updateSubcategories(this.value);
                toggleCustomCategoryInput();
                
                // Reset subcategory selection
                if (subCategorySelect) {
                    subCategorySelect.value = '';
                    toggleCustomSubcategoryInput();
                }
            });
        }
        
        if (subCategorySelect) {
            // Remove existing listeners by cloning and replacing
            const newSubCategorySelect = subCategorySelect.cloneNode(true);
            if (subCategorySelect.parentNode) {
                subCategorySelect.parentNode.replaceChild(newSubCategorySelect, subCategorySelect);
            }
            
            // Update reference to the new element
            subCategorySelect = newSubCategorySelect;
            
            // Add event listener to subcategory select
            subCategorySelect.addEventListener('change', function() {
                toggleCustomSubcategoryInput();
            });
        }
    }
    
    // Initialize with existing values if editing
    function initializeFromExistingData() {
        if (!jobForm || !jobIdField || !jobIdField.value) return;
        
        const existingCategory = document.querySelector('#category').dataset.existingValue || '';
        const existingSubCategory = document.querySelector('#subCategory').dataset.existingValue || '';
        
        if (existingCategory) {
            // Check if the existing category is in our predefined list
            if (Object.keys(categorySubcategoryMap).includes(existingCategory)) {
                categorySelect.value = existingCategory;
            } else {
                // If not in predefined list, select "Other" and set custom value
                categorySelect.value = 'Other';
                if (customCategoryInput) {
                    customCategoryInput.value = existingCategory;
                    customCategoryInput.style.display = 'block';
                    customCategoryInput.required = true;
                }
            }
            
            // Trigger change event to update subcategory options
            const changeEvent = new Event('change');
            categorySelect.dispatchEvent(changeEvent);
            
            // If there's a subcategory, set it after subcategory options are updated
            if (existingSubCategory) {
                // Wait a bit for the subcategory options to update
                setTimeout(() => {
                    // Check if the value is in the current options
                    let subCategoryFound = false;
                    if (subCategorySelect) {
                        Array.from(subCategorySelect.options).forEach(option => {
                            if (option.value === existingSubCategory) {
                                subCategoryFound = true;
                            }
                        });
                        
                        if (subCategoryFound) {
                            subCategorySelect.value = existingSubCategory;
                        } else {
                            // If not in options, select "Other" and set custom value
                            subCategorySelect.value = 'Other';
                            if (customSubCategoryInput) {
                                customSubCategoryInput.value = existingSubCategory;
                                customSubCategoryInput.style.display = 'block';
                                customSubCategoryInput.required = true;
                            }
                        }
                        
                        // Trigger change event
                        const subChangeEvent = new Event('change');
                        subCategorySelect.dispatchEvent(subChangeEvent);
                    }
                }, 100);
            }
        }
    }
    
    // Initialize everything
    initializeCategories();
    setupEventListeners();
    initializeFromExistingData();
    
    // Return functions for external use if needed
    return {
        getCategoryValue: () => {
            if (categorySelect.value === 'Other' && customCategoryInput) {
                return customCategoryInput.value.trim();
            }
            return categorySelect.value;
        },
        getSubCategoryValue: () => {
            if (subCategorySelect.value === 'Other' && customSubCategoryInput) {
                return customSubCategoryInput.value.trim();
            }
            return subCategorySelect.value;
        },
        reset: () => {
            categorySelect.value = '';
            if (subCategorySelect) subCategorySelect.value = '';
            if (customCategoryInput) {
                customCategoryInput.value = '';
                customCategoryInput.style.display = 'none';
            }
            if (customSubCategoryInput) {
                customSubCategoryInput.value = '';
                customSubCategoryInput.style.display = 'none';
            }
        }
    };
}


// --- Load Jobs for Admin View ---
async function loadJobsForAdmin() {
    if (!jobListingsContainerAdmin) {
        console.error("Job listings container not found.");
        return;
    }
    jobListingsContainerAdmin.innerHTML = `
        <div class="list-group-item text-center">
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-2">Loading jobs...</span>
        </div>`;

    try {
        const snapshot = await db.collection('jobPostings')
                                 .orderBy('createdAt', 'desc')
                                 .limit(50)
                                 .get();

        if (snapshot.empty) {
            jobListingsContainerAdmin.innerHTML = '<div class="list-group-item text-muted">No job postings found. Click "Add New Job Posting" to start.</div>';
            return;
        }

        let jobsHTML = '';
        snapshot.forEach(doc => {
            const job = doc.data();
            const docId = doc.id;
            let postedDateStr = 'N/A';
            if (job.postedDate && typeof job.postedDate.toDate === 'function') {
                try {
                    postedDateStr = job.postedDate.toDate().toLocaleDateString();
                } catch (dateError) {
                    console.warn(`Error formatting date for job ${docId}:`, dateError);
                }
            } else if (job.postedDate) {
                 postedDateStr = String(job.postedDate);
            }
            const statusBadgeColor = job.status === 'active' ? 'success' : (job.status === 'expired' ? 'danger' : 'secondary');

            jobsHTML += `
                <div class="list-group-item">
                    <div>
                        <h5 class="mb-1">${job.title || 'No Title'}
                          <span class="badge bg-${statusBadgeColor} ms-2">${job.status || 'unknown'}</span>
                        </h5>
                        <p class="mb-1">
                            <small class="text-muted">
                                <i class="fas fa-building me-1"></i> ${job.companyName || 'N/A'} |
                                <i class="fas fa-map-marker-alt ms-2 me-1"></i> ${job.location || 'N/A'} |
                                <i class="fas fa-tags ms-2 me-1"></i> ${job.category || 'N/A'} / ${job.subCategory || 'N/A'}
                            </small>
                        </p>
                        <small class="text-muted">Posted: ${postedDateStr} | ID: ${docId}</small>
                    </div>
                    <div class="actions flex-shrink-0">
                        <button class="btn btn-sm btn-primary edit-job-btn" data-id="${docId}" title="Edit Job">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm ${job.status === 'active' ? 'btn-warning' : 'btn-success'} toggle-status-btn" 
                                data-id="${docId}" 
                                data-current-status="${job.status}"
                                title="${job.status === 'active' ? 'Deactivate Job' : 'Activate Job'}">
                            <i class="fas ${job.status === 'active' ? 'fa-pause' : 'fa-play'}"></i>
                            ${job.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                        <button class="btn btn-sm btn-danger delete-job-btn" data-id="${docId}" title="Delete Job">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        jobListingsContainerAdmin.innerHTML = jobsHTML;

    } catch (error) {
        console.error("Error loading jobs for admin:", error);
        jobListingsContainerAdmin.innerHTML = '<div class="list-group-item text-danger">Error loading job postings. Please check the console and try again.</div>';
    }
}

if (jobListingsContainerAdmin) {
    jobListingsContainerAdmin.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.edit-job-btn');
        const deleteButton = e.target.closest('.delete-job-btn');
        const toggleStatusButton = e.target.closest('.toggle-status-btn');

        if (editButton) {
            const jobId = editButton.dataset.id;
            if (!jobId) return;
            console.log(`Editing job ID: ${jobId}`);
            const docRef = db.collection('jobPostings').doc(jobId);
            try {
                const docSnap = await docRef.get();
                if (docSnap.exists) { // Fixed: using exists as a property, not a function
                    const jobData = docSnap.data();
                    jobIdField.value = docSnap.id;
                    jobForm.title.value = jobData.title || '';
                    jobForm.companyName.value = jobData.companyName || '';

                    if (jobData.companyLogoUrl) {
                        logoPreview.src = jobData.companyLogoUrl;
                        logoPreview.style.display = 'block';
                        companyLogoUrlField.value = jobData.companyLogoUrl;
                    } else {
                        logoPreview.style.display = 'none';
                        logoPreview.src = '#';
                        companyLogoUrlField.value = '';
                    }
                    companyLogoInput.value = '';
                    currentLogoFile = null;

                    jobForm.location.value = jobData.location || '';
                    jobForm.category.value = jobData.category || '';
                    jobForm.subCategory.value = jobData.subCategory || '';
                    jobForm.description.value = jobData.description || '';
                    jobForm.requirements.value = jobData.requirements || '';
                    jobForm.experienceLevel.value = jobData.experienceLevel || '';
                    jobForm.techStacks.value = (jobData.techStacks || []).join(', ');
                    jobForm.previousInterviewQuestions.value = (jobData.previousInterviewQuestions || []).join(', ');
                    jobForm.sourceLink.value = jobData.sourceLink || '';
                    jobForm.salaryRange.value = jobData.salaryRange || '';

                    // Convert timestamp back to YYYY-MM-DD
                    jobForm.postedDate.value = jobData.postedDate?.toDate?.().toISOString().split('T')[0] || '';
                    jobForm.expiryDate.value = jobData.expiryDate?.toDate?.().toISOString().split('T')[0] || '';

                    jobForm.relocation.checked = jobData.relocation || false;
                    jobForm.status.value = jobData.status || 'inactive';

                    populateCustomFields(jobData.customFields || {});

                    // Ensure modal title reflects "Edit"
                    const modalTitle = document.getElementById('jobModalLabel');
                    if (modalTitle) modalTitle.textContent = 'Edit Job Posting';

                    if (jobModal) jobModal.show();
                } else {
                    alert("Error: Job posting not found.");
                }
            } catch (error) {
                console.error("Error fetching job for edit:", error);
                alert("Error loading job details: " + error.message);
            }

        } else if (deleteButton) {
            const jobId = deleteButton.dataset.id;
            if (!jobId) return;
            console.log(`Attempting to delete job ID: ${jobId}`);
            if (confirm(`Are you sure you want to permanently delete this job posting?\n\nID: ${jobId}`)) {
                try {
                    await db.collection('jobPostings').doc(jobId).delete();
                    alert('Job deleted successfully!');
                    loadJobsForAdmin();
                } catch (error) {
                    console.error("Error deleting job:", error);
                    alert("Error deleting job: " + error.message);
                }
            }
        } else if (toggleStatusButton) {
            const jobId = toggleStatusButton.dataset.id;
            const currentStatus = toggleStatusButton.dataset.currentStatus;
            if (!jobId) return;
            
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            const actionWord = newStatus === 'active' ? 'activate' : 'deactivate';
            
            if (confirm(`Are you sure you want to ${actionWord} this job posting?`)) {
                try {
                    await db.collection('jobPostings').doc(jobId).update({
                        status: newStatus,
                        updatedAt: serverTimestamp()
                    });
                    alert(`Job ${actionWord}d successfully!`);
                    loadJobsForAdmin();
                } catch (error) {
                    console.error(`Error ${actionWord}ing job:`, error);
                    alert(`Error ${actionWord}ing job: ${error.message}`);
                }
            }
        }
    });
}

// --- "Add Job" Button Handling ---
if (addJobBtn) {
    addJobBtn.addEventListener('click', () => {
        jobForm.reset();
        jobIdField.value = '';
        logoPreview.style.display = 'none';
        logoPreview.src = '#';
        companyLogoUrlField.value = '';
        currentLogoFile = null;
        customFieldsContainer.innerHTML = '';

        jobForm.status.value = 'active';
        try {
            jobForm.postedDate.valueAsDate = new Date();
        } catch(e) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            jobForm.postedDate.value = `${yyyy}-${mm}-${dd}`;
        }
        // Ensure the modal title reflects "Add"
        const modalTitle = document.getElementById('jobModalLabel');
        if(modalTitle) modalTitle.textContent = 'Add New Job Posting';
    });
}




// --- Make loadJobsForAdmin globally accessible ---
window.loadJobsForAdmin = loadJobsForAdmin;

console.log("Admin App JS loaded and ready.");
// Initial load is triggered by auth-admin.js after successful login check.

// Add expiry date helper
const expiryDateInput = document.getElementById('expiryDate');
const expiryDateHelp = document.getElementById('expiryDateHelp');

if (expiryDateInput && expiryDateHelp) {
    expiryDateInput.addEventListener('change', function() {
        if (this.value) {
            const expiryDate = new Date(this.value + 'T23:59:59');
            const now = new Date();
            const diffTime = expiryDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                expiryDateHelp.innerHTML = '<span class="text-danger">This date is in the past!</span>';
            } else if (diffDays === 0) {
                expiryDateHelp.innerHTML = '<span class="text-warning">Expires today</span>';
            } else {
                expiryDateHelp.innerHTML = `<span class="text-info">Expires in ${diffDays} days</span>`;
            }
        } else {
            expiryDateHelp.innerHTML = '';
        }
    });
}

