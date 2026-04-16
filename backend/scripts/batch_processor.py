import sys
import os

# Add local vendor directory to path (Absolute path to backend/python_libs)
script_dir = os.path.dirname(os.path.abspath(__file__))
vendor_dir = os.path.abspath(os.path.join(script_dir, '..', 'python_libs'))

if os.path.exists(vendor_dir):
    sys.path.insert(0, vendor_dir)

import pandas as pd
import json

def process_batch(config_path):
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        file_paths = config.get('files', [])
        sheet_name = config.get('sheet_name', 0)
        selected_columns = config.get('columns', [])
        output_format = config.get('output_format', 'xlsx')
        output_filename = config.get('output_filename', 'merged_output')
        mapping = config.get('mapping') or {}
        
        dfs = []
        for file_path in file_paths:
            # Resolve relative paths if necessary
            if not os.path.isabs(file_path):
                file_path = os.path.join(os.getcwd(), file_path)
            
            if not os.path.exists(file_path):
                print(f"ERROR_FILE: Not Found - {file_path}", file=sys.stderr)
                continue

            ext = os.path.splitext(file_path)[1].lower()
            
            try:
                if ext == '.csv':
                    df = pd.read_csv(file_path)
                elif ext in ['.xlsx', '.xls']:
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                else:
                    print(f"ERROR_FILE: Unsupported format - {file_path}", file=sys.stderr)
                    continue
                
                # Apply AI Mapping if available for this specific file
                basename = os.path.basename(file_path)
                if basename in mapping and mapping[basename]:
                    df = df.rename(columns=mapping[basename])

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
                        else:
                            print(f"WARNING: Column '{sc}' not found in {os.path.basename(file_path)}", file=sys.stderr)
                    
                    if final_cols:
                        df = df[final_cols]
                    else:
                        print(f"ERROR_FILE: No matching columns found in {file_path}", file=sys.stderr)
                        continue
                
                dfs.append(df)
            except Exception as e:
                print(f"ERROR_FILE: Processing failed {file_path} - {str(e)}", file=sys.stderr)
        
        if not dfs:
            print("ERROR: No valid data frames created", file=sys.stderr)
            sys.exit(1)
            
        # Merge identical-column dataframes
        final_df = pd.concat(dfs, ignore_index=True)
        
        # Save output with professional formatting
        output_path = f"uploads/{output_filename}.{output_format}"
        
        if output_format == 'csv':
            final_df.to_csv(output_path, index=False)
        else:
            # Enhanced Excel formatting with openpyxl
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                final_df.to_excel(writer, index=False, sheet_name='Merged_Data')
                
                # Access the workbook and stylesheet
                workbook = writer.book
                worksheet = writer.sheets['Merged_Data']
                
                from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
                
                # Define Styles
                header_fill = PatternFill(start_color='E0E0E0', end_color='E0E0E0', fill_type='solid')
                header_font = Font(bold=True, size=11, color='000000')
                thin_border = Border(
                    left=Side(style='thin', color='CCCCCC'),
                    right=Side(style='thin', color='CCCCCC'),
                    top=Side(style='thin', color='CCCCCC'),
                    bottom=Side(style='thin', color='CCCCCC')
                )
                
                # Apply Header Styling
                for cell in worksheet[1]:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal='center', vertical='center')
                    cell.border = thin_border
                
                # Auto-fit Column Widths
                for col in worksheet.columns:
                    max_length = 0
                    column = col[0].column_letter # Get the column name
                    for cell in col:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = (max_length + 4)
                    worksheet.column_dimensions[column].width = adjusted_width
                
                # Apply Cell Borders and Alignment to data rows
                # Deliberately omitted — let users apply their own formatting.
                # Applying borders to every cell is slow on large datasets.

        print(f"SUCCESS_PATH: {output_path}")
        
    except Exception as e:
        print(f"FATAL_ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python batch_processor.py <config_json_path>")
        sys.exit(1)
    process_batch(sys.argv[1])
