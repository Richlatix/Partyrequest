function parseRekordboxXML(xmlContent) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
  const tracks = xmlDoc.getElementsByTagName("TRACK");
  
  const parsedLibrary = [];

  for (let i = 0; i < tracks.length; i++) {
    const title = tracks[i].getAttribute("Name");
    const artist = tracks[i].getAttribute("Artist");

    if (title && artist) {
      parsedLibrary.push({ title, artist });
    }
  }

  return parsedLibrary;
}

// Koppelen aan een bestandsupload op dj.html
async function handleFileUpload(event, djId) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const xmlContent = e.target.result;
    const tracks = parseRekordboxXML(xmlContent);

    // Sla op in Supabase dj_libraries
    const { error } = await supabase
      .from('dj_libraries')
      .upsert({ dj_id: djId, tracks: tracks, updated_at: new Date() });

    if (error) console.error("Upload fout:", error);
    else alert(`${tracks.length} nummers succesvol geüpload!`);
  };

  reader.readAsText(file);
}
