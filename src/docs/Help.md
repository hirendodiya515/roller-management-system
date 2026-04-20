# Help Page

<div class="info-tiles">
  <a href="#guide-version" class="version-card">
    <div class="info-tile">
      <h3>Version</h3>
      <p>v3.1.0</p>
      <p style="font-size: 0.9rem; font-weight: normal; margin-top: 5px;">20-Apr-2026</p>
    </div>
  </a>
  <div class="info-tile">
    <h3>Developer</h3>
    <p>Hiren Dodiya</p>
    <p style="font-size: 0.9rem; font-weight: normal; margin-top: 5px;">hiren.dodiya@borosil.com</p>
  </div>
</div>

## OVERVIEW

Roller management system is an inventory management system for the Rolling machine roller. Here you can track the status of the individual rollers, update the roller, and delete the rollers. For more detail you can explore the tutorial below.

## PAGES

<div class="page-cards-container">
  <a href="#guide-home" class="page-card">
    <h3>Home Page</h3>
    <p>Summary cards with total rollers, alerts sent today, etc. Counts are aggregated from Firestore rollers collection.</p>
  </a>
  <a href="#guide-rollers" class="page-card">
    <h3>Rollers Page</h3>
    <p>View all existing rollers, search, and manage details. Access history and update information.</p>
  </a>
  <a href="#guide-history" class="page-card">
    <h3>History Page</h3>
    <p>Shows the status of the roller and what are the past history of the roller.</p>
  </a>
  <a href="#guide-analysis" class="page-card">
    <h3>Analysis Page</h3>
    <p>Charts for production‑end delay, roller‑sent delay, status distribution. Track delays and location.</p>
  </a>
  
</div>

### HOME/DASHBOARD PAGE

|                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="/help/home.png" alt="Home page"> | <div id="guide-home" style="scroll-margin-top: 100px;"></div>**Home Page**<br>The Home Page provides a quick overview of your roller stock with status.<br><ul><li>**Top Rollers**: Shows the inventory of Top rollers for all the lines.</li><li>**Bottom Rollers**: Shows the inventory of Bottom rollers for all the lines.</li><li>**Side bar**: By clicking on 3 lines at left top you can navigate to different pages.</li><li>_Note_: _By clicking on any card you will redirect to rollers page with filtered roller status._</li></ul> |

### ROLLER PAGE

|                                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="/help/rollers.png" alt="Rollers page">   | <div id="guide-rollers" style="scroll-margin-top: 100px;"></div>**Rollers Page**<br>Here you can see all the existing rollers with quick details and action button .<br><ul><li>**Search bar**: You can search the roller by roller number, line, position.</li><li>**Eye button**: By clicking this, you can access the roller's history records detail.</li><li>**Pen button**: You can modify the roller initial detail with this button.</li><li>**+ Button**: To add new roller click on this button.</li><li>**Approve slice**: This is showing that the roller is approved by HOD.</li></ul> |
| <img src="/help/rollerform.png" alt="Roller form"> | <div id="guide-rollers" style="scroll-margin-top: 100px;"></div>**Roller Form**<br>Once you Click + buttoon you will see this **Register new roller** form where you can add new roller details.<br><ul><li>**Details**: You can fill the roller details here like roller number, make, line, position.</li><li>**Save button**: You can save the roller details here.</li><li>**Cancel button**: You can cancel the form here.</li></ul>                                                                                                                                                           |

### ROLLER HISTORY

|                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <img src="/help/history.png" alt="History page">  | <div id="guide-history" style="scroll-margin-top: 100px;"></div>**History Page**<br>The History Page will give you the details of the roller's tracking (like when it sent to vendor? what is reason? when it received? etc.).<br><ul><li>**Roller details**: Top-left first card is showing the basic detail of roller _(Number, Make, line & position)_.</li><li>**Roller status**: The card right to the roller details shows the current status of the roller based on the history _(card colour will be changed based on the status of the roller)_.</li><li>**History records**: The details below the cards is the actual history of the selected roller with all details _(date, activity, reason, and other parameters)._</li><li>**+ add records**: You can add the history records here.</li></ul> |
| <img src="/help/history2.png" alt="History page"> | <div id="guide-history" style="scroll-margin-top: 100px;"></div>**History Form**<br>Once you click **+ add record** button you can access the add service record form.<br><ul><li>**Date**: Here select the date for the perticular activity by clicking on calender icon.</li><li>**Activity type**: Select the activity from the dropdown _(Production start/End, Roller sent etc)_.</li><li>_Note_: _Based on the selected activity the form will conditionally updated as defined by admin_</li><li>**Save Record**: You can save the history records here.</li></ul>                                                                                                                                                                                                                                     |

### ANALYSIS PAGE

|                                                     |                                                                                                                                                                                                                                                                                                                                                     |
| :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="/help/analysis.png" alt="Analysis page">  | <div id="guide-analysis" style="scroll-margin-top: 100px;"></div>**Analysis Page**<br>The Analysis Page helps you to understand the insights of rollers.<br><ul><li>**Pie Charts**: Visualizes the % and Count of rollers are at each stage for all line.</li><li>**Column Chart**: Shows how many roller sents to the vendor month wise.</li></ul> |
| <img src="/help/analysis2.png" alt="Analysis page"> | <div id="guide-analysis" style="scroll-margin-top: 100px;"></div><ul><li>**Pareto Chart**: Shows the what are the top reason for sending the roller to vendor with cumulative trend.</li><li>**Column Chart**: Shows how many period it takes (in days) from sent to received the roller.</li></ul>                                                 |
| <img src="/help/analysis3.png" alt="Analysis page"> | <div id="guide-analysis" style="scroll-margin-top: 100px;"></div><ul><li>**Line Wise roller list**: For exporting the roller list for the specific line or all line as csv.</li><li>**Complete History**: For exporting the complete history of the all rollers as excel file.</li></ul>                                                            |

### CHANGELOG

| Version | Changes                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1.0   | <div id="guide-version" style="scroll-margin-top: 100px;">**20-Apr-2026**<br><ul><li>Added line **Total roller changes from 136 to 142** in _Dashboard_ and _Rollers_ page.</li><li>Roller counting logic modify to ignore the Roller PDI states</li></ul>                                                                                                                                                              |
| 3.0.0   | <div id="guide-version" style="scroll-margin-top: 100px;">**12-Feb-2025**<br><ul><li>Added line **Total roller changes from 139 to 136** in _Dashboard_ and _Rollers_ page.</li><li>**Back to Dashboard** button added in _Rollers_ page.</li><li>**Date** added in the roller page</li></ul>                                                                                                                           |
| 2.6.0   | <div id="guide-version" style="scroll-margin-top: 100px;">**23-Dec-2025**<br><ul><li>Added line **Total rollers in system _{count of roller}_/139** with **_percentage_** in _Dashboard_ and _Rollers_ page it will give an idea of how many rollers updated in the system from 139 total rollers.</li></ul>                                                                                                            |
| 2.5.0   | <div id="guide-version" style="scroll-margin-top: 100px;">**23-Dec-2025**<br><ul><li>Added **Design-wise Roller Count** at dashboard page after **Last run roller details**.</li><li>By clicking on the roller count next to the line, you can access the rollers page with filtered roller line & selected design.</li></ul>                                                                                           |
| 2.0.0   | <div id="guide-version" style="scroll-margin-top: 100px;">**03-Dec-2025**<br><ul><li>Added Roller PDI option in the activity type, when user select this option then it will add the PDI form in the history records, by clicking on the audit Icon _(in history page)_ it will open the PDI form.</li><li>Added **PDI Report** page where you can see the PDI report of all rollers, Extract PDF report too.</li></ul> |
| 1.5.0   | <div id="guide-version" style="scroll-margin-top: 100px;">**01-Dec-2025**<br><ul><li>Help page added _(with all pages description and images)_ including changelog details. </li></ul>                                                                                                                                                                                                                                  |
| 1.0.0   | **28-Nov-2025**<br><ul><li>Initial release with Basic Stock insights, roller detail with approval flow, dynamic form for history records, analysis page with charts and export functionality, and role based access _(admin, approver, editor and viewer)_. </li></ul>                                                                                                                                                  |
