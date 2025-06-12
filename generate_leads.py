import json
import random
from datetime import datetime, timedelta
from faker import Faker
import uuid
import argparse

# Initialize Faker
fake = Faker()

def generate_phone():
    """Generate a random phone number."""
    return f"+{random.randint(1, 99)}{fake.msisdn()[2:]}"

def generate_social_media():
    """Generate random social media handles."""
    return {
        "facebook": f"https://facebook.com/{fake.user_name()}" if random.random() > 0.3 else "",
        "twitter": f"https://twitter.com/{fake.user_name()}" if random.random() > 0.3 else "",
        "linkedin": f"https://linkedin.com/in/{fake.user_name()}" if random.random() > 0.3 else "",
        "instagram": f"https://instagram.com/{fake.user_name()}" if random.random() > 0.3 else "",
        "telegram": f"@{fake.user_name()}" if random.random() > 0.3 else "",
        "whatsapp": generate_phone() if random.random() > 0.3 else ""
    }

def generate_address():
    """Generate a random address."""
    return {
        "street": fake.street_address(),
        "city": fake.city(),
        "postalCode": fake.postcode()
    }

def generate_documents(lead_type):
    """Generate document URLs for FTD leads."""
    if lead_type == "ftd":
        status_choices = ["good", "ok", "pending"]  # Valid document statuses
        return {
            "idFrontUrl": f"https://storage.example.com/documents/{uuid.uuid4()}/id_front.jpg",
            "idBackUrl": f"https://storage.example.com/documents/{uuid.uuid4()}/id_back.jpg",
            "selfieUrl": f"https://storage.example.com/documents/{uuid.uuid4()}/selfie.jpg",
            "residenceProofUrl": f"https://storage.example.com/documents/{uuid.uuid4()}/residence.jpg",
            "status": random.choice(status_choices)
        }
    return None

def generate_lead():
    """Generate a single lead record."""
    lead_types = ["ftd", "filler", "cold", "live"]
    genders = ["male", "female", "not_defined"]
    priorities = ["low", "medium", "high"]
    statuses = ["active", "contacted", "converted", "inactive"]  # Valid lead statuses
    
    lead_type = random.choice(lead_types)
    
    # Generate base lead data
    lead = {
        "leadType": lead_type,
        "firstName": fake.first_name(),
        "lastName": fake.last_name(),
        "newEmail": fake.email(),
        "oldEmail": fake.email() if random.random() > 0.7 else "",
        "newPhone": generate_phone(),
        "oldPhone": generate_phone() if random.random() > 0.7 else "",
        "country": fake.country(),
        "isAssigned": False,
        "client": fake.company() if random.random() > 0.5 else "",
        "clientBroker": fake.company() if random.random() > 0.5 else "",
        "clientNetwork": fake.company() if random.random() > 0.5 else "",
        "gender": random.choice(genders),
        "socialMedia": generate_social_media(),
        "comments": [],
        "source": random.choice(["website", "referral", "social_media", "direct"]),
        "priority": random.choice(priorities),
        "status": random.choice(statuses),  # Use valid status values
        "createdAt": (datetime.now() - timedelta(days=random.randint(0, 365))).isoformat()
    }
    
    # Add FTD & Filler specific fields
    if lead_type in ["ftd", "filler"]:
        lead.update({
            "dob": (datetime.now() - timedelta(days=random.randint(7300, 25550))).strftime("%Y-%m-%d"),
            "address": generate_address()
        })
    
    # Add FTD specific fields
    if lead_type == "ftd":
        lead.update({
            "documents": generate_documents("ftd"),
            "sin": str(random.randint(100000000, 999999999))
        })
    
    return lead

def generate_leads_file(num_leads=50, output_file="sample_leads.json"):
    """Generate multiple leads and save to a JSON file."""
    leads = [generate_lead() for _ in range(num_leads)]
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {num_leads} leads and saved to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate sample leads data')
    parser.add_argument('num_leads', type=int, nargs='?', default=50,
                      help='Number of leads to generate (default: 50)')
    args = parser.parse_args()
    
    generate_leads_file(num_leads=args.num_leads) 