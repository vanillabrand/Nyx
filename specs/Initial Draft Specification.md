Initial Draft Specification 


Purpose

To run natural language / logic / rule based / forecasting / historical / pattern searching and anomoly detection / potential parts failure / cause & effect analysis queries from users for worldwide flight tracking and incident reporting.


Scope

The Flight Intelligence Engine (FIE) ingests data from three primary sources: ADS-B Exchange (live/historical), Aviation Safety Network (ASN), and internal fleet/maintenance logs. It processes these into a unified knowledge graph, enabling complex analytics that traditional databases cannot handle efficiently.

Key Capabilities

Natural Language Querying (NLQ) 
End-users can ask complex questions in plain English: "Show me all incidents in the last 5 years involving Boeing 737 MAX that resulted in a safety rating worse than 5." The system translates this into graph traversals.

Flight Tracking 
Real-time and historical tracking of flights worldwide. Data includes origin, destination, altitude, speed, heading, and deviations from planned routes.

Incident Investigation 
Correlates flight data with safety reports from ASN. Allows investigators to trace an aircraft's journey before, during, and after an incident.

Pattern Recognition & Anomaly Detection 
AI algorithms identify recurring issues (e.g., specific aircraft types having tail strikes during high-altitude landings). Detects deviations from normal flight patterns that may indicate safety risks.

Forecasting & Predictive Maintenance 
Uses historical performance data and maintenance logs to predict potential part failures. For example, identifying that a specific aircraft series is overdue for a wing inspection based on accumulated flight hours and weather exposure.

Root Cause Analysis 
Performs multi-variable analysis to determine the contributing factors to an incident, considering flight conditions, aircraft health, ATC communication, and crew actions.


Must contain a cool interactive three.js based globe that can show all flights in the air and when clicked on a specific flight should show all the details about that flight and its history. It should also show flight paths and incidents on the globe.  When an incident is clicked on, it should show the details of that incident.  When an aircraft is clicked on, it should show the details of that aircraft and its history.

This must be super cool - and use the latest and greatest UI technologies.  Use Tailwindcss, Vite, Bun, and Bun runtime.  Usetypescript.    Use shadcnui components.  Must use WebLLM for local LLM inference. It should use a lightweight localised model (such as Gemma4b or Phi-3-mini) for natural language understanding and query processing.  No Bloat. Use Neo4j for graph database.  Use AI (Gemini API) for complex analysis and pattern recognition.  It should use a light weight vectorised approach for search and retrieval of information from the graph database. 

Visual Refernces - I like the layouts attached but want the globe and flight data / incident reports and analysis/pattern spotting/realtime alerts/etc all to be in cool little dark themed titled panels that can be moved around. Think of it like a futuristic flight monitoring system. Use small clear and crisp fonts, thin lined componemts, bold and larger readouts & create a unique set of icons for all the different types of reports and alerts.



Data Sources

Real-time Flight Data: 
Integrates with ADS-B Exchange for live aircraft telemetry.

Historical Flight Data: 
Archives of all flights tracked, enabling "look-back" analysis.

Aircraft Specifications & Maintenance Logs: 
Technical details of aircraft (manufacturer, model, age) and maintenance records.

Incident Reports: 
Structured and unstructured data from Aviation Safety Network (ASN) and internal safety databases. (aviation-herald.com is a great source for this data and this should be scraped based on the )

Airports & Routes Database: 
Geospatial data for airports, runways, and standard flight paths.

Constraints & Requirements

Real-time Processing: 
Queries involving live flights must return results with minimal latency (<2 seconds).

Data Privacy: 
Adherence to strict data privacy regulations. Pseudonymization of crew/passenger data where required.

Scalability: 
Ability to handle terabytes of historical flight data and millions of daily updates.

Integration: 
Seamless API integration with existing airline operations and safety management systems.


This should be as cheap and cost effective to run as possible
This should be as scalable as possible 
This should be as fast as possible

The user interface should be web based and must contain the ability to upload files, enter queries in natural language, view results in tables, graphs, and maps, as well as export data in various formats.



To start with you will need to also recommend a database schema to hold the various data from aviation related sources.

Please can you look at a sample of data from aviation-herald.com and identify the best way to structure the data in a graph database to allow for easy and fast querying and analysis and also error / anomaly detection and pattern recognition.  You can use https://aviation-safety.net/index.php to get a broad idea of the type of data and an overview of the type of errors and anomalies and patterns that can be found in aviation.

Once the database schema is designed,  please can you design the database schema for the AI cache and any other collections or tables needed.

Here is some info from the client and two attached files (csv for the data sample from aviation-herald.com and an r file explained below)

for parsing/tabulating.

suggested output columns:
carrier (airline)
aircraft_type
event_location
location_adjective (at/over/near etc, indicates whether event is on the ground or in the air)
report_date
event_date (on average there's a 5-day delay between event and report date, implications for forecasting)
event_text
source_url

future additions:
where there are multiple carriers/aircraft/locatins, then concatent the columns with ;.
event_text_keywords, e.g. fire, landing gear, crew, hydraulics, animal strike.

av_contstants.R file
collection of strings i've used for pattern matching.
airline abbreviations may be most useful initially. note airlines can have local subsidiaries, e.g. American and American Eagle, Air Asia X and Air Asia X Indonesia.

Please spend some quality concentrated time on the database design - this is critical for the performance of the application. And the front end

PLease get started and respond with the full database schema for theneo4j database and also the schema for the ai cache and any other collections or tables needed

You can now build the visual design system for the front-end and the components and design system for the entire application in an orderly fashion.  Let me know when you are ready to proceed to the next step.  


Phase 2

This is also worth consuming and understanding so you can build a forecasting component which can be used to predict trajectories and simulate 

@WILL Rolls eyes and says "Not this shit again - AI can go fuck itself." 

https://www.sciencedirect.com/science/article/pii/S259019822600148X#d1e454