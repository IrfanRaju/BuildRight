import PDFDocument from 'pdfkit';

export function renderEstimatePdf(estimate) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const money = (value) => `PKR ${Math.round(value || 0).toLocaleString('en-PK')}`;
    const generatedAt = new Date().toLocaleString('en-PK');
    doc.fillColor('#101828').fontSize(20).text('BuildRight');
    doc.fontSize(12).fillColor('#FF7518').text('Construction cost estimate report');
    doc.moveDown(0.3).fontSize(10).fillColor('#FF7518').text(estimate.illustrative ? 'Illustrative planning estimate — not a certified bill of quantities' : 'Planning estimate from configured rates');
    if (estimate.estimateId) doc.fillColor('#4B5563').fontSize(9).text(`Estimate ID: ${estimate.estimateId}`);
    doc.fillColor('#4B5563').fontSize(9).text(`Generated: ${generatedAt}`);
    doc.fillColor('#1F2937').moveDown().fontSize(12).text(estimate.input?.projectName || 'Estimate');
    doc.fontSize(10).text(`City: ${estimate.input?.location || ''} · Type: ${estimate.input?.projectType || ''} · Stage: ${estimate.input?.category || ''} · Quality: ${estimate.input?.quality || ''}`);
    doc.text(`Covered area: ${estimate.areas?.coveredPerFloorSqFt || 0} sq ft/floor · Floors: ${estimate.input?.floors || ''} · Built-up: ${estimate.areas?.builtUpSqFt || 0} sq ft`);
    doc.text(`Structure: ${estimate.input?.structureType || 'Framed RCC'}`);
    doc.moveDown().fontSize(16).text(money(estimate.total));
    doc.fontSize(10).text(`Cost per sq ft: ${money(estimate.costPerSqFt)} · Timeline: ${estimate.timelineLabel || ''}`);
    if (estimate.timeline?.completionDate) {
      doc.text(`Indicative start ${estimate.timeline.startDate || '—'} → completion ${estimate.timeline.completionDate}`);
    }
    doc.moveDown().fontSize(12).text('Cost summary');
    for (const [label, value] of [
      ['Materials', estimate.materialCost],
      ['Labor', estimate.laborCost],
      ['Equipment and transportation', estimate.equipmentCost],
      ['Overhead', estimate.overhead],
      [`Contractor margin (${estimate.marginResolution?.percent ?? estimate.input?.marginPercent ?? 0}%)`, estimate.contractorMargin],
      ['Contingency', estimate.contingency],
      ['Tax', estimate.tax],
    ]) doc.fontSize(10).text(`${label}: ${money(value)}`);

    if (estimate.regionalAdjustment) {
      doc.moveDown().fontSize(12).text('Regional adjustment');
      doc.fontSize(9).text(`${estimate.regionalAdjustment.city}: multiplier ${estimate.regionalAdjustment.multiplier}, transport ${estimate.regionalAdjustment.transportAdjustment} — ${estimate.regionalAdjustment.note}`);
    }

    doc.moveDown().fontSize(12).text('Quantities');
    const quantities = estimate.quantities || {};
    doc.fontSize(10).text(`Cement ${quantities.cementBags || 0} bags · Steel ${quantities.steelKg || 0} kg · Sand ${quantities.sandCft || 0} cft · Crush ${quantities.crushCft || 0} cft · Bricks ${quantities.bricks || 0}`);
    if (quantities.tiles || quantities.paint || quantities.electrical || quantities.plumbing) {
      doc.text(`Tiles ${quantities.tiles || 0} · Paint ${quantities.paint || 0} · Electrical ${quantities.electrical || 0} · Plumbing ${quantities.plumbing || 0}`);
    }
    doc.moveDown().fontSize(12).text('Material lines');
    for (const line of estimate.lines || []) {
      doc.fontSize(9).text(`${line.name}: ${line.quantity} ${line.unit} × ${money(line.unitRate)} = ${money(line.cost)} (${line.scope})`);
    }
    if (estimate.timeline?.phases?.length) {
      doc.moveDown().fontSize(12).text('Indicative schedule');
      for (const phase of estimate.timeline.phases) {
        const range = phase.startDate ? `${phase.startDate} → ${phase.endDate}` : `day ${phase.startOffsetDays}–${phase.endOffsetDays}`;
        doc.fontSize(9).text(`${phase.label}: ${phase.durationDays} days (${range})${phase.overlapsPrevious ? ' · overlaps previous' : ''}`);
      }
    }
    doc.moveDown().fontSize(12).text('Assumptions');
    for (const item of estimate.assumptions || []) doc.fontSize(9).text(`• ${item}`);
    doc.moveDown().fontSize(12).text('Exclusions');
    for (const item of estimate.exclusions || []) doc.fontSize(9).text(`• ${item}`);
    doc.moveDown().fontSize(9).fillColor('#4B5563').text(`Rate source: ${estimate.source || 'Not recorded'}`);
    doc.text(`Rates last updated: ${estimate.rateUpdatedAt || 'Unknown'}`);
    doc.text(estimate.limitations || '');
    doc.end();
  });
}

function pdfBuffer(draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

const money = (value) => `PKR ${Math.round(value || 0).toLocaleString('en-PK')}`;

export function renderOrderInvoice(order) {
  return pdfBuffer((doc) => {
    doc.fillColor('#101828').fontSize(20).text('BuildRight material invoice');
    doc.moveDown(0.3).fontSize(10).fillColor('#FF7518').text(order.priceNotice || 'Catalog prices at checkout. These are not live market prices.');
    doc.fillColor('#1F2937').moveDown().fontSize(12).text(`Order ${order.orderNumber}`);
    doc.fontSize(10).text(`Status: ${order.status}`);
    doc.text(`Placed: ${new Date(order.createdAt).toLocaleString('en-PK')}`);
    const address = order.address || {};
    doc.moveDown().text(`${address.name || ''} · ${address.phone || ''}`);
    doc.text(`${address.line1 || ''}, ${address.city || ''}`);
    if (address.instructions) doc.text(`Instructions: ${address.instructions}`);
    doc.moveDown().fontSize(12).text('Materials');
    for (const item of order.items || []) {
      doc.fontSize(9).text(`${item.name} (${item.brand || 'Unbranded'}): ${item.quantity} ${item.unit} × ${money(item.unitPrice)} = ${money(item.lineTotal)}`);
    }
    doc.moveDown().fontSize(10).text(`Subtotal: ${money(order.subtotal)}`);
    doc.text(`Delivery: ${money(order.deliveryCharge)}`);
    doc.text(`Tax: ${money(order.tax)}`);
    doc.fontSize(14).text(`Total: ${money(order.total)}`);
    doc.moveDown().fontSize(9).fillColor('#4B5563').text('You can cancel while the order is Pending or Confirmed. Stock is returned when an order is cancelled before dispatch.');
  });
}

export function renderRepairReport(project) {
  return pdfBuffer((doc) => {
    const estimate = project.estimate || {};
    doc.fillColor('#101828').fontSize(20).text('BuildRight repair planning report');
    doc.moveDown(0.3).fontSize(10).fillColor('#FF7518').text(estimate.disclaimer || 'Planning estimate. Results depend on actual site conditions.');
    doc.fillColor('#1F2937').moveDown().fontSize(12).text(project.title || 'Repair project');
    doc.fontSize(10).text(`${project.buildingType || ''} · ${project.location || ''} · Progress: ${project.progress || ''}`);
    if (project.budget) doc.text(`Customer budget: ${money(project.budget)}`);
    if (project.startDate) doc.text(`Desired start: ${project.startDate}`);
    doc.moveDown().fontSize(12).text('Selected work');
    for (const task of project.tasks || []) doc.fontSize(10).text(`• ${task.title || task.serviceSlug} · ${task.condition || ''} · ${task.quality || ''}`);
    doc.moveDown().fontSize(12).text('Estimated materials');
    for (const line of estimate.materials || []) {
      doc.fontSize(9).text(`${line.name}: ${line.quantity} ${line.unit} × ${money(line.unitPrice)} = ${money(line.lineTotal)}${line.unmatched ? ' (no catalog price)' : ''}`);
    }
    doc.moveDown().fontSize(10).text(`Material cost: ${money(estimate.materialCost)}`);
    doc.text(`Labor cost (separate from the material order): ${money(estimate.laborCost)}`);
    doc.text(`Equipment: ${money(estimate.equipmentCost)}`);
    doc.text(`Delivery: ${money(estimate.delivery)}`);
    doc.text(`Tax: ${money(estimate.tax)}`);
    doc.text(`Contingency: ${money(estimate.contingency)}`);
    doc.fontSize(14).text(`Total estimated budget: ${money(estimate.total)}`);
    if (project.notes) {
      doc.moveDown().fontSize(12).text('Notes');
      doc.fontSize(10).text(project.notes);
    }
    doc.moveDown().fontSize(9).fillColor('#4B5563').text('Photographs and any AI preview are visual references only. They are not proof that hidden damage has been repaired.');
  });
}
