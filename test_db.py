import psycopg2
conn = psycopg2.connect(dbname='kitchen_master_db', user='postgres', password='root', host='localhost', port=5432)
cur = conn.cursor()
cur.execute('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ''inventory_items''')
for row in cur.fetchall(): print(row[0], row[1])
cur.close()
conn.close()
