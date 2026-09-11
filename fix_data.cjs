const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Buscando pedido...");
  // O id do pedido deve ser 5530 ou estar em algum campo como order_number.
  const { data: sales, error: saleErr } = await supabase
    .from('sales')
    .select('*')
    .eq('id', '5530');
    
  if (saleErr) {
    console.error("Erro ao buscar pedido:", saleErr);
  } else if (!sales || sales.length === 0) {
    console.log("Pedido 5530 não encontrado no campo 'id', tentando buscar por algum numero de nota ou semelhante se houver. Exibindo os últimos 5:");
    const { data: lastSales } = await supabase.from('sales').select('id, created_at').order('created_at', { ascending: false }).limit(5);
    console.log(lastSales);
  } else {
    console.log("Pedido 5530:", sales);
  }

  const { data: items, error: itemsErr } = await supabase
    .from('sale_items')
    .select(`
      id,
      sale_id,
      dispatch_status,
      products(name)
    `)
    .eq('sale_id', '5530');

  if (itemsErr) {
    console.error("Erro ao buscar itens:", itemsErr);
  } else {
    console.log("Itens do pedido 5530:", JSON.stringify(items, null, 2));
    
    // Atualizar o item
    const targetItem = items?.find(i => i.products?.name?.toLowerCase().includes('urban 6p'));
    if (targetItem) {
        console.log(`Encontrado item: ${targetItem.products.name}. Atualizando para SEPARADO...`);
        const { error: updateErr } = await supabase
            .from('sale_items')
            .update({ dispatch_status: 'SEPARADO' })
            .eq('id', targetItem.id);
        
        if (updateErr) {
            console.error("Erro ao atualizar:", updateErr);
        } else {
            console.log("Sucesso ao atualizar dispatch_status para SEPARADO.");
        }
    } else {
        console.log("Item 'urban 6p' não encontrado no pedido 5530.");
    }
  }
}

run();
