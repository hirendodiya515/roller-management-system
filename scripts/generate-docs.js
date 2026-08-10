import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.join(__dirname, '../public/docs');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const documents = [
  {
    filename: 'inspection_plan.pdf',
    title: 'Quality Inspection & Testing Plan',
    code: 'QIP-2026-RLR',
    category: 'Inspection & Testing',
    sections: [
      '1. Objective: Define quality inspection standards for ceramic and metallic rollers.',
      '2. Scope: Applicable to incoming raw material, in-process machining, and final PDI.',
      '3. Visual Inspection: Check for surface cracks, pitting, concentricity, and dimensional tolerance (±0.05mm).',
      '4. Ultrasonic Testing (UT): 100% UT scan for internal voids or material inclusions.',
      '5. Thermal Shock Test: Test up to 1200°C for refractory rollers under 3 thermal cycles.',
      '6. Acceptance Criteria: Zero surface defects, runout within ISO 2768-mK tolerances.',
      '7. Document Owner: Quality Assurance Department.'
    ]
  },
  {
    filename: 'maintenance_standard.pdf',
    title: 'Roller Maintenance & Lubrication Standard',
    code: 'SOP-MNT-042',
    category: 'Maintenance',
    sections: [
      '1. Overview: Preventive maintenance schedule and lubrication guidelines for kiln rollers.',
      '2. Daily Checks: Monitor bearing temperature (Max 75°C), vibration level (<2.8 mm/s).',
      '3. Weekly Maintenance: Inspect seal integrity, clean roller surface from debris.',
      '4. Monthly Lubrication: Apply High-Temp Synthetic Grease (NLGI Grade 2) to main bearing housings.',
      '5. Quarterly Alignment: Laser alignment of roller axle centers and drive coupling offset.',
      '6. Emergency Shutdown Protocol: Procedures during sudden thermal overload or bearing seizure.',
      '7. Maintenance Lead: Mechanical Engineering Division.'
    ]
  },
  {
    filename: 'pdi_checklist.pdf',
    title: 'Pre-Delivery Inspection (PDI) Quality Checklist',
    code: 'CHK-PDI-809',
    category: 'Quality Assurance',
    sections: [
      '1. Item Identifier & Serial Verification: Cross-check serial numbers against Job Card.',
      '2. Dimensional Accuracy: Shaft diameter, overall length, keyway tolerances.',
      '3. Dynamic Balancing: Balance verification at 1500 RPM according to ISO 1940 G2.5.',
      '4. Surface Coating & Treatment: Chrome plating thickness check (min 30 microns).',
      '5. Protective Packaging: VCI anti-corrosion wrap, wooden crate reinforcement.',
      '6. Sign-off Requirements: Signed by QA Manager and Customer Representative.',
      '7. Form Version: 2026.1 Revision A.'
    ]
  },
  {
    filename: 'refractory_guidelines.pdf',
    title: 'Refractory Lining & Thermal Operating Guidelines',
    code: 'GUI-REF-105',
    category: 'Technical Specifications',
    sections: [
      '1. Purpose: Operating parameters for high-temperature refractory roller kilns.',
      '2. Maximum Operating Temperature: 1350°C continuous, 1400°C peak.',
      '3. Thermal Expansion Coefficient: 5.2 x 10^-6 /°C.',
      '4. Heating Rate Limit: Maximum 150°C per hour ramp-up speed to prevent thermal shock.',
      '5. Cooling Protocol: Controlled atmosphere cooling down to 200°C before atmosphere exposure.',
      '6. Recommended Refractory Mortar: High Alumina (70% Al2O3) bonding paste.',
      '7. Metallurgy & Materials Dept.'
    ]
  },
  {
    filename: 'safety_sop.pdf',
    title: 'Safety & Operational Standard Operating Procedure',
    code: 'SOP-SAF-001',
    category: 'Safety & Compliance',
    sections: [
      '1. Personal Protective Equipment (PPE): Heat-resistant gloves, safety goggles, steel-toe boots.',
      '2. Hot Work Permitting: Mandatory permit required prior to maintenance in furnace zone.',
      '3. Lock-Out / Tag-Out (LOTO): Isolate primary power and hydraulic pressure before servicing.',
      '4. Emergency Stop Switches: Locations of E-Stop buttons along the roller conveyor line.',
      '5. Incident Reporting: Notify EHS Officer within 15 minutes of any near-miss event.',
      '6. Compliance: OSHA 1910.212 & ISO 45001 Certified Procedure.',
      '7. EHS Management Team.'
    ]
  },
  {
    filename: 'job_card_guide.pdf',
    title: 'Job Card & Work Order Execution Guide',
    code: 'GUI-JBC-303',
    category: 'Operating Manuals',
    sections: [
      '1. Workflow Summary: How to initiate, assign, track, and close job cards in RMS.',
      '2. Mandatory Fields: Equipment ID, Issue Description, Target Completion Date, Assigned Technician.',
      '3. Status Transitions: Draft -> Pending Approval -> In Progress -> Quality Audit -> Closed.',
      '4. Material Requisition: Linking spare parts used to stock inventory IDs.',
      '5. Sign-off & Audit Trail: Digital signature recording for compliance reporting.',
      '6. Operations Support Contacts: ext 4401 / rms-support@factory.com.',
      '7. Production Planning Dept.'
    ]
  }
];

console.log('Generating PDF documents in', docsDir);

documents.forEach((docData) => {
  const doc = new jsPDF();
  
  // Header Banner
  doc.setFillColor(25, 118, 210); // Primary Blue #1976d2
  doc.rect(0, 0, 210, 35, 'F');
  
  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ROLLER MANAGEMENT SYSTEM', 15, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Doc Code: ${docData.code}  |  Category: ${docData.category}`, 15, 27);
  
  // Title
  doc.setTextColor(33, 33, 33);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(docData.title, 15, 50);
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(25, 118, 210);
  doc.line(15, 54, 195, 54);
  
  // Content Sections
  let yPos = 66;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  
  docData.sections.forEach((section) => {
    const lines = doc.splitTextToSize(section, 180);
    doc.text(lines, 15, yPos);
    yPos += (lines.length * 7) + 4;
  });
  
  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 275, 195, 275);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Confidential - Industrial Roller Management System Documentation © 2026', 15, 283);
  doc.text('Page 1 of 1', 170, 283);

  const filePath = path.join(docsDir, docData.filename);
  const pdfOutput = doc.output('arraybuffer');
  fs.writeFileSync(filePath, Buffer.from(pdfOutput));
  console.log(`Saved: ${docData.filename}`);
});

console.log('PDF Generation Complete!');
