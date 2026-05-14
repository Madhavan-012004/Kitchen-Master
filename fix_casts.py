import os, re

def replace_in_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    def replacer(m):
        prefix = m.group(1) # (String) 
        var_name = m.group(2) # data
        method = m.group(3) # get or getOrDefault
        args = m.group(4) # "barcode"
        
        if method == 'get':
            return f'{var_name}.get({args}) != null ? String.valueOf({var_name}.get({args})) : null'
        elif method == 'getOrDefault':
            parts = args.split(',', 1)
            if len(parts) == 2:
                key = parts[0].strip()
                default_val = parts[1].strip()
                return f'{var_name}.get({key}) != null ? String.valueOf({var_name}.get({key})) : {default_val}'
        return m.group(0)

    # \(String\)\s*([a-zA-Z0-9_]+)\.(get|getOrDefault)\(([^)]+)\)
    new_content = re.sub(r'\(String\)\s*([a-zA-Z0-9_]+)\.(get|getOrDefault)\(([^)]+)\)', replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {filepath}')

base_dir = r'c:\FILES\KITCHEN MASTER\backend2\src\main\java\com\probloom\service'
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.java'):
            replace_in_file(os.path.join(root, f))
