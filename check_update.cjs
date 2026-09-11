const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wpryhjhfgmggvvyamyfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnloamhmZ21nZ3Z2eWFteWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzkwNDQsImV4cCI6MjA4NzcxNTA0NH0.XoD41Sd-nBubS6pLjAhaYAIsttfoI1TE3Om8fU9L7dk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUpdates() {
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .eq('id', '5530')
    .single();

  if (error) {
    console.error("Erro:", error);
    return;
  }
  
  console.log("Pedido:", sales);

  const { data: items } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', '5530');
    
  console.log("Itens:", items);
}

checkUpdates();
