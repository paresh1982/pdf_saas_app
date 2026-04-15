import pandas as pd
import os

# Create two dummy CSV files for testing the merger
data1 = {
    'Invoice_ID': ['INV-001', 'INV-002'],
    'Date': ['2024-01-01', '2024-01-02'],
    'Amount': [100.50, 200.75]
}
data2 = {
    'Invoice_ID': ['INV-003', 'INV-004'],
    'Date': ['2024-01-03', '2024-01-04'],
    'Amount': [300.00, 450.25]
}

df1 = pd.DataFrame(data1)
df2 = pd.DataFrame(data2)

# Save to artifacts directory (mocking a local test environment)
os.makedirs('test_data', exist_ok=True)
df1.to_csv('test_data/test_file_1.csv', index=False)
df2.to_csv('test_data/test_file_2.csv', index=False)

print("Sample test files created at test_data/")
