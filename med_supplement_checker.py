import json
import os
from datetime import datetime
import requests
from typing import Dict, List, Optional

# Configuration
DATA_FILE = 'medication_supplement_log.json'
DISCLAIMER = """
╔════════════════════════════════════════════════════════════════════════════╗
║                          ⚠️  IMPORTANT DISCLAIMER  ⚠️                      ║
║                                                                            ║
║  This tool provides general information about medications and supplements. ║
║  It is NOT a substitute for professional medical advice.                  ║
║                                                                            ║
║  ALWAYS consult with your doctor or healthcare provider before:           ║
║  • Starting or stopping any medication                                    ║
║  • Taking new supplements                                                 ║
║  • Combining medications and supplements                                  ║
║                                                                            ║
║  In case of medical emergency, call emergency services immediately.       ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

class MedicationSupplementChecker:
    def __init__(self):
        self.log_data = self.load_log()
        self.api_endpoints = {
            'openFDA': 'https://api.fda.gov/drug',
            'drugBank': 'https://www.drugbank.ca/api/v1',
            'pubChem': 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
        }

    def load_log(self) -> Dict:
        """Load existing log file or create new one"""
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return {'queries': []}
        return {'queries': []}

    def save_log(self):
        """Save log data to flat file"""
        with open(DATA_FILE, 'w') as f:
            json.dump(self.log_data, f, indent=2)
        print(f"\n✓ Log saved to {DATA_FILE}")

    def add_query_log(self, query_type: str, search_term: str, results: Dict, sources: List[str]):
        """Add query to log"""
        query_entry = {
            'timestamp': datetime.now().isoformat(),
            'query_type': query_type,
            'search_term': search_term,
            'results_found': len(results.get('items', [])) if results else 0,
            'sources_checked': sources,
            'data': results
        }
        self.log_data['queries'].append(query_entry)
        self.save_log()

    def lookup_medication(self, med_name: str) -> Optional[Dict]:
        """
        Lookup medication using OpenFDA API (free endpoint)
        """
        print(f"\
🔍 Searching for medication: {med_name}")
        sources = []
        results = {'items': []}

        try:
            # OpenFDA endpoint - requires API key but has free tier
            # For this demo, using generic drug search
            url = f"https://api.fda.gov/drug/label.json?search=openfda.generic_name:{med_name}"
            
            print("   Checking: OpenFDA API...")
            response = requests.get(url, timeout=5)
            sources.append('OpenFDA API')
            
            if response.status_code == 200:
                data = response.json()
                if 'results' in data:
                    for item in data['results'][:5]:  # Limit to 5 results
                        drug_info = {
                            'brand_name': item.get('openfda', {}).get('brand_name', ['N/A'])[0],
                            'generic_name': item.get('openfda', {}).get('generic_name', ['N/A'])[0],
                            'manufacturer': item.get('openfda', {}).get('manufacturer_name', ['N/A'])[0],
                            'route': item.get('openfda', {}).get('route', ['N/A'])[0],
                            'dosage_form': item.get('openfda', {}).get('dosage_form', ['N/A'])[0],
                            'warnings': item.get('warnings', ['N/A']),
                            'adverse_reactions': item.get('adverse_reactions', ['N/A']),
                            'precautions': item.get('precautions', ['N/A']),
                            'contraindications': item.get('contraindications', ['N/A']),
                            'pregnancy': item.get('pregnancy', ['N/A']),
                            'nursing': item.get('nursing_mothers', ['N/A']),
                            'pediatric_use': item.get('pediatric_use', ['N/A'])
                        }
                        results['items'].append(drug_info)
        except requests.exceptions.Timeout:
            print("   ⚠️  OpenFDA API timeout")
        except requests.exceptions.RequestException as e:
            print(f"   ⚠️  Error querying OpenFDA: {str(e)}")

        # Fallback to PubChem for additional info
        try:
            print("   Checking: PubChem API...")
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{med_name}/property/MolecularFormula,MolecularWeight,InChI/JSON"
            response = requests.get(url, timeout=5)
            sources.append('PubChem API')
            
            if response.status_code == 200:
                pubchem_data = response.json()
                if 'PropertyTable' in pubchem_data:
                    compound = pubchem_data['PropertyTable']['Properties'][0]
                    results['pubchem_info'] = {
                        'molecular_formula': compound.get('MolecularFormula', 'N/A'),
                        'molecular_weight': compound.get('MolecularWeight', 'N/A')
                    }
        except requests.exceptions.RequestException as e:
            print(f"   ⚠️  Error querying PubChem: {str(e)}")

        if results['items']:
            self.add_query_log('medication', med_name, results, sources)
            return results
        else:
            print(f"   ❌ No results found for: {med_name}")
            self.add_query_log('medication', med_name, {}, sources)
            return None

    def lookup_supplement(self, supp_name: str) -> Optional[Dict]:
        """
        Lookup supplement using PubChem and NIH APIs (free endpoints)
        """
        print(f"\
🔍 Searching for supplement: {supp_name}")
        sources = []
        results = {'items': []}

        try:
            # PubChem compound search
            print("   Checking: PubChem API...")
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{supp_name}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IUPACName/JSON"
            response = requests.get(url, timeout=5)
            sources.append('PubChem API')
            
            if response.status_code == 200:
                pubchem_data = response.json()
                if 'PropertyTable' in pubchem_data:
                    for compound in pubchem_data['PropertyTable']['Properties']:
                        supp_info = {
                            'name': supp_name,
                            'molecular_formula': compound.get('MolecularFormula', 'N/A'),
                            'molecular_weight': compound.get('MolecularWeight', 'N/A'),
                            'iupac_name': compound.get('IUPACName', 'N/A'),
                            'source': 'PubChem'
                        }
                        results['items'].append(supp_info)
        except requests.exceptions.RequestException as e:
            print(f"   ⚠️  Error querying PubChem: {str(e)}")

        # Try NIH Natural Products database
        try:
            print("   Checking: NIH NCBI APIs...")
            # Using Entrez API for natural products/supplements
            url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={supp_name}+supplement&retmax=5&rettype=json"
            response = requests.get(url, timeout=5)
            sources.append('NIH NCBI Entrez API')
            
            if response.status_code == 200:
                results['pubmed_search'] = f"Found related PubMed articles for: {supp_name}"
        except requests.exceptions.RequestException as e:
            print(f"   ⚠️  Error querying NIH NCBI: {str(e)}")

        if results['items']:
            self.add_query_log('supplement', supp_name, results, sources)
            return results
        else:
            print(f"   ❌ No results found for: {supp_name}")
            self.add_query_log('supplement', supp_name, {}, sources)
            return None

    def format_section(self, title: str, content: List[str]) -> str:
        """Format a section with title and content"""
        if not content or content == ['N/A']:
            return ""
        
        output = f"\n   {title}:\
"
        for item in content:
            if item and item != 'N/A':
                output += f"   • {item}\
"
        return output

    def display_medication_results(self, results: Dict):
        """Display medication lookup results with complete side effect output"""
        print("\
" + "="*80)
        print("MEDICATION INFORMATION")
        print("="*80)
        
        if not results or not results.get('items'):
            print("❌ No results found.")
            return

        for idx, item in enumerate(results['items'], 1):
            print(f"\
{'='*80}")
            print(f"📋 RESULT {idx}")
            print(f"{'='*80}")
            
            print(f"\n   Brand Name: {item.get('brand_name', 'N/A')}")
            print(f"   Generic Name: {item.get('generic_name', 'N/A')}")
            print(f"   Manufacturer: {item.get('manufacturer', 'N/A')}")
            print(f"   Route: {item.get('route', 'N/A')}")
            print(f"   Dosage Form: {item.get('dosage_form', 'N/A')}")

            # Display all complete sections
            warnings = item.get('warnings', [])
            if warnings and warnings != ['N/A']:
                print(self.format_section("⚠️  WARNINGS", warnings))

            adverse = item.get('adverse_reactions', [])
            if adverse and adverse != ['N/A']:
                print(self.format_section("⚠️  ADVERSE REACTIONS (SIDE EFFECTS)", adverse))

            precautions = item.get('precautions', [])
            if precautions and precautions != ['N/A']:
                print(self.format_section("📌 PRECAUTIONS", precautions))

            contraindications = item.get('contraindications', [])
            if contraindications and contraindications != ['N/A']:
                print(self.format_section("🚫 CONTRAINDICATIONS", contraindications))

            pregnancy = item.get('pregnancy', [])
            if pregnancy and pregnancy != ['N/A']:
                print(self.format_section("🤰 PREGNANCY", pregnancy))

            nursing = item.get('nursing', [])
            if nursing and nursing != ['N/A']:
                print(self.format_section("👶 NURSING MOTHERS", nursing))

            pediatric = item.get('pediatric_use', [])
            if pediatric and pediatric != ['N/A']:
                print(self.format_section("👧 PEDIATRIC USE", pediatric))

        # Display chemical information
        pubchem = results.get('pubchem_info', {})
        if pubchem:
            print(f"\
{'='*80}")
            print("🧪 CHEMICAL INFORMATION (PubChem)")
            print(f"{'='*80}")
            print(f"\n   Molecular Formula: {pubchem.get('molecular_formula', 'N/A')}")
            print(f"   Molecular Weight: {pubchem.get('molecular_weight', 'N/A')}")

        print("\n" + "="*80)
        print("Sources: OpenFDA API, PubChem API")
        print("="*80 + "\
")

    def display_supplement_results(self, results: Dict):
        """Display supplement lookup results"""
        print("\
" + "="*80)
        print("SUPPLEMENT INFORMATION")
        print("="*80)
        
        if not results or not results.get('items'):
            print("❌ No results found.")
            return

        for idx, item in enumerate(results['items'], 1):
            print(f"\n{'='*80}")
            print(f"🌿 RESULT {idx}")
            print(f"{'='*80}")
            print(f"\
   Name: {item.get('name', 'N/A')}")
            print(f"   Molecular Formula: {item.get('molecular_formula', 'N/A')}")
            print(f"   Molecular Weight: {item.get('molecular_weight', 'N/A')}")
            print(f"   IUPAC Name: {item.get('iupac_name', 'N/A')}")

        pubmed = results.get('pubmed_search')
        if pubmed:
            print(f"\
{'='*80}")
            print("📚 RESEARCH INFORMATION")
            print(f"{'='*80}")
            print(f"\
   {pubmed}")
            print("   Check PubMed for peer-reviewed research on this supplement.")

        print("\
" + "="*80)
        print("Sources: PubChem API, NIH NCBI Entrez API")
        print("="*80 + "\
")

    def view_query_history(self):
        """Display query history"""
        if not self.log_data['queries']:
            print("\n📭 No queries in history.")
            return

        print("\
" + "="*80)
        print("QUERY HISTORY (Last 10 Queries)")
        print("="*80)
        
        for idx, query in enumerate(self.log_data['queries'][-10:], 1):
            timestamp = query['timestamp']
            query_type = query['query_type'].upper()
            search_term = query['search_term']
            found = query['results_found']
            sources = ', '.join(query['sources_checked'])
            
            print(f"\
{idx}. [{timestamp}]")
            print(f"   Type: {query_type}")
            print(f"   Search Term: '{search_term}'")
            print(f"   Results Found: {found}")
            print(f"   Sources Checked: {sources}")

        print("\
" + "="*80 + "\
")

    def display_menu(self):
        """Display main menu"""
        print("\
" + "="*80)
        print("MEDICATION & SUPPLEMENT LOOKUP TOOL")
        print("="*80)
        print("\
1. 💊 Medication Lookup")
        print("2. 🌿 Supplement Lookup")
        print("3. 📜 View Query History")
        print("4. ❌ Exit")
        print("\n" + "="*80)

    def run(self):
        """Main application loop"""
        print(DISCLAIMER)
        
        while True:
            self.display_menu()
            choice = input("\
Enter your choice (1-4): ").strip()

            if choice == '1':
                med_name = input("Enter medication name: ").strip()
                if med_name:
                    results = self.lookup_medication(med_name)
                    if results:
                        self.display_medication_results(results)
                else:
                    print("❌ Please enter a medication name.")

            elif choice == '2':
                supp_name = input("Enter supplement name: ").strip()
                if supp_name:
                    results = self.lookup_supplement(supp_name)
                    if results:
                        self.display_supplement_results(results)
                else:
                    print("❌ Please enter a supplement name.")

            elif choice == '3':
                self.view_query_history()

            elif choice == '4':
                print("\n" + DISCLAIMER)
                print("\n👋 Thank you for using Medication & Supplement Lookup Tool!")
                print("   Remember: Always consult your doctor before making changes to your medications.\n")
                break

            else:
                print("❌ Invalid choice. Please enter 1, 2, 3, or 4.")


def main():
    """Entry point"""
    checker = MedicationSupplementChecker()
    checker.run()


if __name__ == '__main__':
    main()