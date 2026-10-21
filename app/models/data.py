from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class SkillId(str, Enum):
    WELDER = 'welder'
    CONSTRUCTION = 'construction'
    LOADER = 'loader'
    ELECTRICIAN = 'electrician'
    PAINTER = 'painter'
    HELPER = 'helper'

SKILLS = [
    {'id': SkillId.WELDER, 'label': 'Welder', 'hi': 'वेल्डर'},
    {'id': SkillId.CONSTRUCTION, 'label': 'Construction', 'hi': 'निर्माण'},
    {'id': SkillId.LOADER, 'label': 'Loader', 'hi': 'लोडर'},
    {'id': SkillId.ELECTRICIAN, 'label': 'Electrician', 'hi': 'बिजली'},
    {'id': SkillId.PAINTER, 'label': 'Painter', 'hi': 'पेंटर'},
    {'id': SkillId.HELPER, 'label': 'Helper', 'hi': 'हेल्पर'},
]

@dataclass
class Job:
    id: str
    title: str
    titleHi: str
    factory: str
    verified: bool
    distanceKm: float
    wage: int
    skill: SkillId
    shift: str

JOBS: List[Job] = [
    Job('j1', 'Welder (Arc)', 'वेल्डर', 'Shree Ganesh Auto Parts', True, 2.5, 750, SkillId.WELDER, '8 AM – 6 PM'),
    Job('j2', 'Truck Loader', 'ट्रक लोडर', 'Bharat Logistics Hub', True, 1.2, 600, SkillId.LOADER, '7 AM – 3 PM'),
    Job('j3', 'Site Mason', 'राजमिस्त्री', 'Om Builders', False, 4.8, 800, SkillId.CONSTRUCTION, '9 AM – 6 PM'),
    Job('j4', 'Factory Electrician', 'बिजली मिस्त्री', 'Sunrise Textiles', True, 3.1, 900, SkillId.ELECTRICIAN, '10 AM – 7 PM'),
    Job('j5', 'Warehouse Helper', 'गोदाम हेल्पर', 'Kisan Agro Foods', True, 0.8, 550, SkillId.HELPER, '8 AM – 5 PM'),
    Job('j6', 'Wall Painter', 'दीवार पेंटर', 'Om Builders', False, 5.6, 700, SkillId.PAINTER, '9 AM – 5 PM'),
    Job('j7', 'Gas Welder', 'गैस वेल्डर', 'Metro Steel Works', True, 6.2, 820, SkillId.WELDER, '8 AM – 4 PM'),
]

class MyJobStatus(str, Enum):
    APPLIED = 'applied'
    SELECTED = 'selected'
    PAID = 'paid'

@dataclass
class MyJob:
    id: str
    title: str
    factory: str
    date: str
    wage: int
    status: MyJobStatus
    payment: Optional[str] = None  # 'upi' or 'cash'

MY_JOBS: List[MyJob] = [
    MyJob('m1', 'Truck Loader', 'Bharat Logistics Hub', 'Tomorrow, 7 AM', 600, MyJobStatus.SELECTED),
    MyJob('m2', 'Welder (Arc)', 'Metro Steel Works', '18 Oct', 820, MyJobStatus.PAID, 'upi'),
    MyJob('m3', 'Warehouse Helper', 'Kisan Agro Foods', '16 Oct', 550, MyJobStatus.PAID, 'cash'),
    MyJob('m4', 'Site Mason', 'Om Builders', '14 Oct', 800, MyJobStatus.PAID, 'upi'),
]

@dataclass
class Applicant:
    id: str
    name: str
    age: int
    rating: float
    verified: bool
    skills: List[str]
    distanceKm: float
    jobsDone: int

APPLICANTS: List[Applicant] = [
    Applicant('a1', 'Ramesh Kumar', 32, 4.8, True, ['Welding', 'Fabrication'], 2.1, 64),
    Applicant('a2', 'Suresh Yadav', 28, 4.5, True, ['Welding', 'Grinding'], 3.4, 31),
    Applicant('a3', 'Mohd. Arif', 35, 4.9, True, ['Arc Welding', 'CNC'], 5.0, 112),
    Applicant('a4', 'Vikram Singh', 24, 4.1, False, ['Helper', 'Welding'], 1.6, 9),
]

COMPLETED_WORKERS = [
    {'id': 'c1', 'name': 'Rajesh Pal', 'job': 'Machine Operator', 'date': '19 Oct'},
    {'id': 'c2', 'name': 'Anil Verma', 'job': 'Machine Operator', 'date': '19 Oct'},
]

MANAGER_JOBS = [
    {'id': 'JB-2041', 'title': 'Welder (Arc)', 'applicants': 4, 'needed': 2, 'wage': 750},
    {'id': 'JB-2038', 'title': 'Machine Operator', 'applicants': 9, 'needed': 5, 'wage': 680},
    {'id': 'JB-2035', 'title': 'Packing Helper', 'applicants': 5, 'needed': 3, 'wage': 520},
]

SKILL_KEYWORDS = {
    'machine': ['#CNC', '#Packaging'],
    'operator': ['#MachineOperator'],
    'weld': ['#Welding', '#Fabrication'],
    'load': ['#Loading', '#Lifting'],
    'pack': ['#Packaging', '#Labelling'],
    'mason': ['#Masonry', '#Construction'],
    'construct': ['#Construction', '#Masonry'],
    'paint': ['#Painting', '#Finishing'],
    'electric': ['#Wiring', '#Electrical'],
    'helper': ['#Helper', '#GeneralLabour'],
    'driver': ['#Driving', '#Forklift'],
}

@dataclass
class PendingFactory:
    id: str
    name: str
    owner: str
    gstin: str
    city: str
    submitted: str

PENDING_FACTORIES: List[PendingFactory] = [
    PendingFactory('f1', 'Sunrise Textiles Pvt Ltd', 'Anita Mehra', '07AABCS1429B1Z5', 'Okhla, Delhi', '2 hrs ago'),
    PendingFactory('f2', 'Om Builders', 'Rakesh Gupta', '09AAFPO4567K1ZP', 'Noida Sec 63', '5 hrs ago'),
    PendingFactory('f3', 'Metro Steel Works', 'Harpreet Singh', '06AACCM9910L1Z2', 'Manesar, Gurugram', 'Yesterday'),
]

@dataclass
class PendingLaborer:
    id: str
    name: str
    age: int
    eshram: str
    kyc: str
    skill: str
    submitted: str

PENDING_LABORERS: List[PendingLaborer] = [
    PendingLaborer('l1', 'Vikram Singh', 24, 'UAN 1012-4421-xxxx', 'Aadhaar OTP', 'Helper', '30 min ago'),
    PendingLaborer('l2', 'Sunita Devi', 29, 'UAN 1019-8873-xxxx', 'Manual', 'Packing', '1 hr ago'),
    PendingLaborer('l3', 'Bablu Prasad', 41, 'UAN 1003-2210-xxxx', 'Aadhaar OTP', 'Mason', '3 hrs ago'),
]

class PayoutStatus(str, Enum):
    HELD = 'Held'
    WORK_DONE = 'Work Done'
    PAID_UPI = 'Paid UPI'
    CASH_ZONE = 'Cash Zone'
    REFUNDED = 'Refunded'

@dataclass
class EscrowRow:
    id: str
    factory: str
    escrow: int
    workers: int
    status: PayoutStatus

ESCROW_ROWS: List[EscrowRow] = [
    EscrowRow('JB-2041', 'Shree Ganesh Auto', 15750, 2, PayoutStatus.HELD),
    EscrowRow('JB-2038', 'Shree Ganesh Auto', 35700, 5, PayoutStatus.WORK_DONE),
    EscrowRow('JB-2029', 'Bharat Logistics', 25200, 6, PayoutStatus.WORK_DONE),
    EscrowRow('JB-2017', 'Kisan Agro Foods', 11550, 3, PayoutStatus.PAID_UPI),
    EscrowRow('JB-2011', 'Om Builders', 16800, 4, PayoutStatus.CASH_ZONE),
]

@dataclass
class MassRequest:
    id: str
    factory: str
    job: str
    needed: int
    assigned: int
    date: str

MASS_REQUESTS: List[MassRequest] = [
    MassRequest('MH-118', 'Bharat Logistics Hub', 'Truck Loader', 25, 12, '23 Oct'),
    MassRequest('MH-117', 'Sunrise Textiles', 'Packing Helper', 15, 0, '24 Oct'),
    MassRequest('MH-115', 'Om Builders', 'Site Labour', 10, 6, '25 Oct'),
]

VERIFIED_POOL = [
    {'id': 'v1', 'name': 'Ramesh Kumar', 'zone': 'Zone 4', 'distanceKm': 1.1, 'rating': 4.8},
    {'id': 'v2', 'name': 'Deepak Sharma', 'zone': 'Zone 4', 'distanceKm': 1.6, 'rating': 4.6},
    {'id': 'v3', 'name': 'Mohd. Arif', 'zone': 'Zone 2', 'distanceKm': 2.3, 'rating': 4.9},
    {'id': 'v4', 'name': 'Sunita Devi', 'zone': 'Zone 4', 'distanceKm': 2.8, 'rating': 4.7},
    {'id': 'v5', 'name': 'Bablu Prasad', 'zone': 'Zone 3', 'distanceKm': 3.4, 'rating': 4.4},
    {'id': 'v6', 'name': 'Rajesh Pal', 'zone': 'Zone 2', 'distanceKm': 3.9, 'rating': 4.5},
    {'id': 'v7', 'name': 'Anil Verma', 'zone': 'Zone 3', 'distanceKm': 4.5, 'rating': 4.3},
    {'id': 'v8', 'name': 'Kamla Bai', 'zone': 'Zone 4', 'distanceKm': 5.2, 'rating': 4.8},
]

STATUS_STYLE = {
    PayoutStatus.HELD: 'bg-warning-soft text-warning',
    PayoutStatus.WORK_DONE: 'bg-manager-soft text-manager',
    PayoutStatus.PAID_UPI: 'bg-accent text-accent-foreground',
    PayoutStatus.CASH_ZONE: 'bg-accent text-accent-foreground',
    PayoutStatus.REFUNDED: 'bg-muted text-muted-foreground',
}

MY_JOB_STATUS = {
    MyJobStatus.APPLIED: {'en': 'Applied', 'hi': 'आवेदन किया', 'icon': 'hourglass', 'tone': 'border-l-warning', 'chip': 'bg-warning-soft text-warning'},
    MyJobStatus.SELECTED: {'en': 'Selected for Work', 'hi': 'काम के लिए चुने गए', 'icon': 'user-check', 'tone': 'border-l-manager', 'chip': 'bg-manager-soft text-manager'},
    MyJobStatus.PAID: {'en': 'Work Done & Paid', 'hi': 'काम पूरा, पैसा मिला', 'icon': 'circle-check', 'tone': 'border-l-primary', 'chip': 'bg-accent text-accent-foreground'},
}

FEEDBACK_TAGS = ['Punctual', 'Hardworking', 'Skilled', 'Safe Worker', 'Team Player']

PLATFORM_FEE = 0.05
MASS_HIRE_PER_WORKER = 50

def format_inr(n: int) -> str:
    return f'₹{n:,}'

def detect_skills(title: str) -> List[str]:
    lower = title.lower()
    tags = set()
    for kw, lst in SKILL_KEYWORDS.items():
        if kw in lower:
            tags.update(lst)
    return list(tags)