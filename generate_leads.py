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
        # Using encoded URL to ensure proper display in browser
        image_url = "https://d.newsweek.com/en/full/1888025/gary-lee-holding-id-face.jpg"
        return {
            "idFrontUrl": image_url,
            "idBackUrl": image_url,
            "selfieUrl": image_url,
            "residenceProofUrl": image_url,
            "status": random.choice(status_choices)
        }
    return None

def generate_comments():
    """Generate random comments for a lead."""
    num_comments = random.randint(0, 3)  # Generate 0 to 3 comments per lead
    comments = []
    
    comment_templates = [
        "Initial contact made, {interest} in trading",
        "Client shows {level} knowledge about {market}",
        "Followed up via {channel}, {response}",
        "Discussed {product} options, {outcome}",
        "Scheduled {meeting_type} for {timeframe}",
        "{language} barrier noted, {solution} required",
        "Client prefers {communication} for future contact",
        "Potential for {investment_type} investment identified",
        "Requires more information about {topic}",
        "Previous experience with {broker}, {experience}"
    ]
    
    interest_levels = ["very interested", "somewhat interested", "showing interest", "highly interested"]
    knowledge_levels = ["basic", "intermediate", "advanced", "limited"]
    markets = ["forex", "stocks", "crypto", "commodities", "indices"]
    channels = ["email", "phone", "WhatsApp", "Telegram", "LinkedIn"]
    responses = ["positive response", "will consider options", "requested more info", "needs time to decide"]
    products = ["CFD", "forex pairs", "commodity futures", "stock options"]
    outcomes = ["showing promise", "needs follow-up", "very enthusiastic", "considering proposal"]
    meeting_types = ["video call", "phone consultation", "online demo", "strategy session"]
    timeframes = ["next week", "tomorrow", "next month", "this Friday"]
    languages = ["English", "Spanish", "Mandarin", "Arabic"]
    solutions = ["translator", "simplified materials", "native speaker", "visual aids"]
    communication = ["email", "phone", "messaging apps", "video calls"]
    investment_types = ["short-term", "long-term", "day trading", "swing trading"]
    topics = ["trading platforms", "account types", "fee structure", "trading strategies"]
    brokers = ["previous broker", "local broker", "online platform", "traditional bank"]
    experiences = ["positive experience", "mixed results", "negative experience", "limited exposure"]
    
    for _ in range(num_comments):
        template = random.choice(comment_templates)
        comment = template.format(
            interest=random.choice(interest_levels),
            level=random.choice(knowledge_levels),
            market=random.choice(markets),
            channel=random.choice(channels),
            response=random.choice(responses),
            product=random.choice(products),
            outcome=random.choice(outcomes),
            meeting_type=random.choice(meeting_types),
            timeframe=random.choice(timeframes),
            language=random.choice(languages),
            solution=random.choice(solutions),
            communication=random.choice(communication),
            investment_type=random.choice(investment_types),
            topic=random.choice(topics),
            broker=random.choice(brokers),
            experience=random.choice(experiences)
        )
        
        # Generate a random date within the last 30 days
        comment_date = datetime.now() - timedelta(days=random.randint(0, 30))
        
        comments.append({
            "text": comment,
            "createdAt": comment_date.isoformat()
        })
    
    return comments

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
        "comments": generate_comments(),  # Add generated comments
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