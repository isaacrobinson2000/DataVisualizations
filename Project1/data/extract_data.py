import pandas as pd
import numpy as np
import sys
from pathlib import Path

def main(args):
    this_dir = Path(args[0]).parent
    
    df = pd.read_excel(str(list(this_dir.glob("*.xlsx"))[0]), header=2, index_col=0)
    
    ex_cols = [
        # The total...
        "Average annual expenditures", 
        # General categories...
        "Food",
        "Housing",
        "Apparel and services",
        "Transportation",
        "Healthcare",
        "Entertainment",
        "Personal care products and services",
        "Reading",
        "Education***",
        "Tobacco products and smoking supplies",
        "Miscellaneous***",
        "Cash contributions",
        "Personal insurance and pensions",
        # Specific to food...
        "Food at home", 
        "Food away from home", 
        "Cereals and bakery products", 
        "Meats, poultry, fish, and eggs",
        "Dairy products",
        "Fruits and vegetables",
        "Other food at home"
    ]
    
    cols = [df.loc[col] for col in ex_cols]
    
    final_df = pd.DataFrame(cols, columns=df.columns, index=ex_cols).T
    final_df.index = final_df.index.rename("Year")
    
    final_df.to_csv(this_dir / "food_spending.csv")
    
    
    
if(__name__ == "__main__"):
    main(sys.argv)

