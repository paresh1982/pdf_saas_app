import pandas as pd
import json
import sys
import os

def process_batch(config_path):
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        file_paths = config.get('files', [])
        sheet_name = config.get('sheet_name', 0)
        selected_columns = config.get('columns', [])
        output_format = config.get('output_format', 'xlsx')
        output_filename = config.get('output_filename', 'merged_output')
        
        dfs = []
        for file_path in file_paths:
            ext = os.path.splitext(file_path)[1].lower()
            
            try:
                if ext == '.csv':
                    df = pd.read_csv(file_path)
                elif ext in ['.xlsx', '.xls']:
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                else:
                    continue
                
                # Filter columns if specified
                if selected_columns:
                    # Case-insensitive column matching fallback
                    existing_cols = {c.lower(): c for c in df.columns}
                    final_cols = []
                    for sc in selected_columns:
                        if sc in df.columns:
                            final_cols.append(sc)
                        elif sc.lower() in existing_cols:
                            final_cols.append(existing_cols[sc.lower()])
                    
                    if final_cols:
                        df = df[final_cols]
                
                dfs.append(df)
            except Exception as e:
                print(f"ERROR_FILE: {file_path} - {str(e)}", file=sys.stderr)
        
        if not dfs:
            print("ERROR: No valid data frames created", file=sys.stderr)
            sys.exit(1)
            
        # Merge identical-column dataframes
        final_df = pd.concat(dfs, ignore_index=True)
        
        # Save output
        output_path = f"uploads/{output_filename}.{output_format}"
        if output_format == 'csv':
            final_df.to_csv(output_path, index=False)
        else:
            final_df.to_excel(output_path, index=False, engine='openpyxl')
            
        print(f"SUCCESS_PATH: {output_path}")
        
    except Exception as e:
        print(f"FATAL_ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python batch_processor.py <config_json_path>")
        sys.exit(1)
    process_batch(sys.argv[1])
