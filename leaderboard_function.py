import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import pytz

# Configura tu credencial para el entorno local o el entorno de ejecución (ej. Cloud Functions)
# cred = credentials.Certificate('path/to/serviceAccountKey.json')
# firebase_admin.initialize_app(cred)
# db = firestore.client()

def calculate_weekly_winners():
    """
    Calcula los ganadores semanales para las categorías 'Carro' y 'Moto'.
    Filtra por conductores con calificación >= 4.5 y cuenta servicios exitosos en los últimos 7 días.
    """
    db = firestore.client()
    
    # Rango de tiempo: Últimos 7 días
    now = datetime.now(pytz.utc)
    seven_days_ago = now - timedelta(days=7)
    
    periodo_id = f"weekly_{now.strftime('%Y-W%W')}"
    
    categorias = ['carro', 'moto']
    resultados_finales = {}

    for categoria in categorias:
        print(f"--- Calculando Ranking Semanal: {categoria.upper()} ---")
        
        # 1. Obtener conductores elegibles (Calificación >= 4.5 y categoría correcta)
        conductores_ref = db.collection('conductores')
        conductores_query = conductores_ref.where('vehiculo.tipo', '==', categoria).where('calificacion', '>=', 4.5).stream()
        
        ranking_data = []
        
        for cond_doc in conductores_query:
            cond_id = cond_doc.id
            cond_data = cond_doc.to_dict()
            
            # 2. Contar viajes finalizados en los últimos 7 días para este conductor
            viajes_ref = db.collection('viajes')
            # Nota: Firestore requiere índices para filtros complejos. 
            # Aquí filtramos por conductor, estado 'finalizado' y fecha.
            viajes_query = viajes_ref.where('conductorId', '==', cond_id) \
                                     .where('estado', '==', 'finalizado') \
                                     .where('fecha_finalizacion', '>=', seven_days_ago.isoformat()) \
                                     .stream()
            
            servicios_semanales = sum(1 for _ in viajes_query)
            
            if servicios_semanales > 0:
                ranking_data.append({
                    'conductorId': cond_id,
                    'nombre': cond_data.get('nombre', 'Desconocido'),
                    'servicios_semanales': servicios_semanales,
                    'calificacion': cond_data.get('calificacion', 0),
                    'foto': cond_data.get('foto', None)
                })
        
        # 3. Ordenar por servicios (desc) y calificación (desc) como desempate
        ranking_data.sort(key=lambda x: (x['servicios_semanales'], x['calificacion']), reverse=True)
        
        # Tomar los top 10
        top_10 = ranking_data[:10]
        for i, driver in enumerate(top_10):
            driver['rank'] = i + 1
            
        ganador_id = top_10[0]['conductorId'] if top_10 else None
        
        # 4. Guardar en la colección 'leaderboards'
        # Estructura: /leaderboards/weekly_2026-W19_carro
        doc_id = f"{periodo_id}_{categoria}"
        db.collection('leaderboards').document(doc_id).set({
            'periodoId': periodo_id,
            'categoria': categoria,
            'fechaCalculo': firestore.SERVER_TIMESTAMP,
            'conductores': top_10,
            'ganadorId': ganador_id,
            'finalizado': True
        })
        
        resultados_finales[categoria] = {
            'ganador': top_10[0] if top_10 else None,
            'total_participantes': len(ranking_data)
        }
        
    return resultados_finales

# Ejemplo de ejecución:
# if __name__ == "__main__":
#     winners = calculate_weekly_winners()
#     print(winners)
