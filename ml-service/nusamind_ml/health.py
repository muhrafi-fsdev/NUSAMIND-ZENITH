from __future__ import annotations
RED_FLAGS={
 'cardiac':['nyeri dada','dada tertekan','keringat dingin'],
 'breathing':['sesak berat','sulit bernapas','bibir membiru'],
 'stroke':['wajah mencong','bicara pelo','lemah satu sisi'],
 'bleeding':['perdarahan hebat','muntah darah','bab hitam','hamil perdarahan','kehamilan perdarahan'],
 'neurologic':['kejang','tidak sadar','pingsan lama'],
 'poisoning':['overdosis','terlalu banyak parasetamol','terlalu banyak obat','keracunan','minum obat terlalu banyak']}
HEALTH_TERMS={'obat','gejala','penyakit','terapi','dokter','herbal','jamu','warfarin','kunyit','hamil','laboratorium','lab','x-ray','rontgen','dosis','parasetamol'}
def analyze_health(text:str)->dict:
 low=' '.join(text.lower().split());matches=[]
 for gate,terms in RED_FLAGS.items():
  for term in terms:
   if term in low:matches.append({'gate':gate,'term':term,'severity':'critical'})
 active=bool(matches) or any(x in low for x in HEALTH_TERMS)
 dose=any(x in low for x in ('naikkan dosis','berapa mg','dosis resep','minum berapa'))
 prescription=any(x in low for x in ('warfarin','insulin','antibiotik','obat resep','pengencer darah'))
 medical_image=any(x in low for x in ('x-ray','rontgen','ct scan','mri','usg'))
 privacy=active and any(x in low for x in ('hamil','obat','lab','hasil pemeriksaan','riwayat'))
 emergency=bool(matches)
 gate='emergency' if emergency else 'dose_boundary' if dose and prescription else 'medical_image' if medical_image else 'routine' if active else 'not_health'
 return{'active':active,'gate':gate,'severity':'critical' if emergency else 'high' if gate in {'dose_boundary','medical_image'} else 'low','emergency':emergency,'matches':matches,'triggers':[x['term'] for x in matches],'diagnosis_allowed':False,'personalized_dose_allowed':False,'image_boundary':medical_image,'privacy_sensitive':privacy,'handoff':'Segera cari bantuan medis darurat.' if emergency else None}
