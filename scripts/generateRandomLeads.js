const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');

// Set to keep track of used emails to ensure uniqueness
const usedEmails = new Set();

// Function to generate a unique email
const generateUniqueEmail = () => {
    let email;
    do {
        email = faker.internet.email();
    } while (usedEmails.has(email));
    usedEmails.add(email);
    return email;
};

// Function to generate a random lead
const generateRandomLead = () => {
    const leadTypes = ['ftd', 'filler', 'cold', 'live'];
    const genders = ['male', 'female', 'not_defined'];
    const documentStatuses = ['good', 'ok', 'pending'];
    const priorities = ['low', 'medium', 'high'];
    const statuses = ['active', 'contacted', 'converted', 'inactive'];

    const leadType = faker.helpers.arrayElement(leadTypes);
    const gender = faker.helpers.arrayElement(genders);

    const lead = {
        leadType,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        gender,
        email: generateUniqueEmail(), // Primary email field for the database
        newEmail: generateUniqueEmail(),
        oldEmail: Math.random() > 0.5 ? generateUniqueEmail() : undefined,
        newPhone: faker.phone.number(),
        oldPhone: Math.random() > 0.5 ? faker.phone.number() : undefined,
        country: faker.location.country(),
        isAssigned: false,
        client: Math.random() > 0.5 ? faker.company.name() : undefined,
        clientBroker: Math.random() > 0.5 ? faker.company.name() : undefined,
        clientNetwork: Math.random() > 0.5 ? faker.company.name() : undefined,
        socialMedia: {
            facebook: Math.random() > 0.5 ? faker.internet.userName() : undefined,
            twitter: Math.random() > 0.5 ? faker.internet.userName() : undefined,
            linkedin: Math.random() > 0.5 ? faker.internet.userName() : undefined,
            instagram: Math.random() > 0.5 ? faker.internet.userName() : undefined,
            telegram: Math.random() > 0.5 ? faker.internet.userName() : undefined,
            whatsapp: Math.random() > 0.5 ? faker.phone.number() : undefined,
        },
        source: faker.helpers.arrayElement(['website', 'referral', 'social_media', 'cold_call']),
        priority: faker.helpers.arrayElement(priorities),
        status: faker.helpers.arrayElement(statuses),
    };

    // Add FTD & Filler specific fields if applicable
    if (leadType === 'ftd' || leadType === 'filler') {
        lead.dob = faker.date.past({ years: 50 });
        lead.address = {
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            postalCode: faker.location.zipCode(),
        };
    }

    // Add FTD specific fields
    if (leadType === 'ftd') {
        lead.documents = {
            idFrontUrl: faker.image.url(),
            idBackUrl: faker.image.url(),
            selfieUrl: faker.image.url(),
            residenceProofUrl: faker.image.url(),
            status: faker.helpers.arrayElement(documentStatuses),
        };
        lead.sin = faker.string.numeric(9); // Generate a 9-digit SIN number
    }

    return lead;
};

// Function to generate leads and save them to a JSON file
const generateLeads = (count) => {
    try {
        // Clear the used emails set at the start of each generation
        usedEmails.clear();

        const leads = [];
        console.log(`Generating ${count} leads...`);

        for (let i = 0; i < count; i++) {
            const lead = generateRandomLead();
            leads.push(lead);
            if ((i + 1) % 10 === 0) {
                console.log(`Generated ${i + 1} leads...`);
            }
        }

        // Create a timestamp for unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, '..', 'data');
        const outputFile = path.join(outputDir, `leads_${timestamp}.json`);

        // Create the data directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write the leads to a JSON file
        fs.writeFileSync(outputFile, JSON.stringify(leads, null, 2));
        console.log(`Successfully generated and saved ${count} leads to ${outputFile}`);
    } catch (error) {
        console.error('Error:', error);
    }
};

// Get the number of leads to generate from command line argument
const count = parseInt(process.argv[2]) || 10;

// Run the main function
generateLeads(count); 