/**
 * TSPL (TSC Label Printer) Helper Utility
 * Generates raw command strings for thermal label printers.
 * Based on the 3-up template provided in LABLE.prn (101.6mm x 25.4mm)
 */

export const generateTSPL = (items, shopName = "My Shop", height = 22.5, gap = 3.0) => {
  // Constants from updated LABLE.prn
  const header = [
    `SIZE 101.6 mm, ${height} mm`,
    `GAP ${gap} mm, 0 mm`,
    "DIRECTION 0,0",
    "REFERENCE 0,0",
    "OFFSET 0 mm",
    "SET PEEL OFF",
    "SET CUTTER OFF",
    "SET PARTIAL_CUTTER OFF",
    "SET TEAR ON",
    "CODEPAGE 1252",
  ];

  let commands = [];
  
  // The template has 3 labels across. We need to group items into sets of 3.
  const batchedItems = [];
  items.forEach(item => {
    for (let i = 0; i < (item.printQty || 1); i++) {
      batchedItems.push(item);
    }
  });

  for (let i = 0; i < batchedItems.length; i += 3) {
    commands.push("CLS");
    
    // Process up to 3 items for this row
    const row = [batchedItems[i], batchedItems[i+1], batchedItems[i+2]];
    
    // Base X-offsets for the 3 sections from updated template
    const xPositions = [754, 486, 218];
    
    row.forEach((item, idx) => {
      if (!item) return;

      const baseX = xPositions[idx];
      const barcodeValue = item.barcode || "00000000";
      const name = (item.name || "Product").toUpperCase();
      const priceVal = `${item.price || 0}`;
      const mrpVal = `${item.mrp || item.price || 0}`;

      // Section coordinates from UPDATED LABLE.prn (v3)
      // Section 1: 754(shop), 790(name), 771(price), 605(mrp), 696(qr), 709(text-bc)
      // Rel offsets: 0, +36, +17, -149, -58, -45
      // Wait, let's look at relative offsets again:
      // 790 - 754 = 36
      // 771 - 754 = 17 
      // 605 - 754 = -149
      // 696 - 754 = -58
      // 709 - 754 = -45
      
      const off = [0, 36, 17, -149, -58, -45];

      commands.push(`TEXT ${baseX + off[0]},167,"ROMAN.TTF",180,1,11,"${shopName}"`);
      commands.push(`TEXT ${baseX + off[1]},127,"ROMAN.TTF",180,1,5,"${name.substring(0, 25)}"`);
      commands.push(`TEXT ${baseX + off[2]},95,"ROMAN.TTF",180,1,7,"${priceVal}"`);
      commands.push(`TEXT ${baseX + off[3]},95,"ROMAN.TTF",180,1,7,"${mrpVal}"`);
      commands.push(`QRCODE ${baseX + off[4]},107,L,3,A,180,M2,S7,"${barcodeValue}"`);
      commands.push(`TEXT ${baseX + off[5]},28,"0",180,8,7,"${barcodeValue}"`);
    });

    commands.push("PRINT 1,1");
  }

  return header.join("\r\n") + "\r\n" + commands.join("\r\n") + "\r\n";
};
