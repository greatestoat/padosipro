import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Own client on purpose: the seed shouldn't need JWT/SMTP settings just to run.
const prisma = new PrismaClient();

const tasks: Array<{ name: string; category: string; description: string }> = [
  // Home
  { name: "House Cleaning", category: "Home", description: "Regular cleaning of rooms, kitchen and bathrooms" },
  { name: "Laundry", category: "Home", description: "Washing, drying and folding of clothes" },
  { name: "Home Maintenance", category: "Home", description: "General repairs and upkeep around the house" },
  { name: "Pest Control", category: "Home", description: "Treatment for insects, rodents and other pests" },
  { name: "Plumbing Repair", category: "Home", description: "Fix leaks, blocked drains and faulty taps" },
  { name: "Electrical Repair", category: "Home", description: "Fix wiring, switches, fans and lights" },

  // Errands
  { name: "Grocery Shopping", category: "Errands", description: "Buy and deliver your weekly groceries" },
  { name: "Medicine Pickup", category: "Errands", description: "Collect prescriptions from the pharmacy" },
  { name: "Courier Pickup", category: "Errands", description: "Send or collect parcels and documents" },
  { name: "Bill Payment", category: "Errands", description: "Pay electricity, water and other bills in person" },
  { name: "Document Submission", category: "Errands", description: "Drop off forms and paperwork at offices" },
  { name: "Gift Shopping", category: "Errands", description: "Choose and buy gifts for friends and family" },

  // Personal
  { name: "Doctor Appointment", category: "Personal", description: "Book and manage doctor visits" },
  { name: "Salon Appointment", category: "Personal", description: "Book haircuts, grooming and spa sessions" },
  { name: "Restaurant Reservation", category: "Personal", description: "Reserve a table at your favourite restaurant" },
  { name: "Gym Booking", category: "Personal", description: "Book gym slots and fitness classes" },
  { name: "Tailoring Pickup", category: "Personal", description: "Drop off and collect stitched or altered clothes" },
  { name: "Travel Booking", category: "Personal", description: "Arrange tickets and stays for your trips" },

  // Vehicle
  { name: "Car Service", category: "Vehicle", description: "Scheduled servicing and repairs for your car" },
  { name: "Car Wash", category: "Vehicle", description: "Exterior and interior car cleaning" },
  { name: "Bike Service", category: "Vehicle", description: "Scheduled servicing for two-wheelers" },
  { name: "Tyre Replacement", category: "Vehicle", description: "Tyre checks, puncture repair and replacement" },
  { name: "Fuel Delivery", category: "Vehicle", description: "Get fuel delivered to your location" },
  { name: "Insurance Renewal", category: "Vehicle", description: "Renew vehicle insurance and pollution certificate" },
];

async function main() {
  // upsert on the unique `name`: safe to run as many times as you like.
  for (const task of tasks) {
    await prisma.task.upsert({
      where: { name: task.name },
      create: task,
      update: { category: task.category, description: task.description },
    });
  }
  console.log(`Seeded ${tasks.length} tasks across 4 categories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());